package ch.celestin.fuelr.ai;

import ch.celestin.fuelr.admin.AdminAccess;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

/**
 * What the assisted reads have cost, and who made them.
 *
 * An operator's page, not a product one: what it is for is deciding a ceiling
 * and a price. It answers in dollars and micro-dollars because that is what
 * the provider bills in — converting to francs here would add a rate to be
 * wrong about on top of a figure that is already exact.
 *
 * Admin only, through `AdminAccess` like every other section of the panel: it
 * lists other people's email addresses and what they consumed, which is the
 * whole reason it is not a screen anybody can reach. The check used to live
 * here, privately; with five sections behind the same door a second copy is a
 * second place to get it wrong, and the way this goes wrong is that one
 * endpoint answers to everybody.
 */
@RestController
@RequestMapping("/api/admin/ai-costs")
public class AiCostController {

    public record Totals(
            long calls,
            long inputTokens,
            long outputTokens,
            long costMicros) {
    }

    public record OperationRow(
            String operation,
            long calls,
            long inputTokens,
            long outputTokens,
            long costMicros) {
    }

    public record AccountRow(
            Long userId,
            String email,
            long calls,
            long inputTokens,
            long outputTokens,
            long costMicros,
            Instant lastCall,
            /** This account's own ceiling, so a row can be read on its own. */
            long budgetMicros) {
    }

    /**
     * The month, and everything.
     *
     * Both, because they answer different questions: the month says whether a
     * ceiling is about to be hit, and the total says what the feature costs to
     * run. A page showing only one of them would have to be reloaded with a
     * parameter to answer the other.
     */
    public record CostReport(
            Totals month,
            Totals allTime,
            /** What everybody together may spend this month. */
            long monthlyCeilingMicros,
            List<OperationRow> operationsThisMonth,
            List<AccountRow> accountsThisMonth,
            List<AccountRow> accountsAllTime) {
    }

    private final AiUsageRepository usage;
    private final AiBudget budget;
    private final AdminAccess access;

    public AiCostController(AiUsageRepository usage, AiBudget budget, AdminAccess access) {
        this.usage = usage;
        this.budget = budget;
        this.access = access;
    }

    @GetMapping
    public CostReport report(@AuthenticationPrincipal Jwt principal) {
        access.require(principal);

        List<AccountRow> month = accounts(usage.perAccountSince(AiBudget.period()));
        List<AccountRow> all = accounts(usage.perAccountSince(AiBudget.BEGINNING));
        return new CostReport(
                total(month),
                total(all),
                budget.totalBudgetMicros(),
                usage.perOperationSince(AiBudget.period()).stream()
                        .map(row -> new OperationRow(
                                row.getOperation(), row.getCalls(),
                                row.getInputTokens(), row.getOutputTokens(),
                                row.getCostMicros()))
                        .toList(),
                month,
                all);
    }

    private List<AccountRow> accounts(List<AiUsageRepository.PerAccount> rows) {
        return rows.stream()
                .map(row -> new AccountRow(
                        row.getUserId(), row.getEmail(), row.getCalls(),
                        row.getInputTokens(), row.getOutputTokens(),
                        row.getCostMicros(), row.getLastCall(),
                        budget.budgetMicros(row.getUserId())))
                .toList();
    }

    /** Summed from the rows shown, so the total and the table cannot disagree. */
    private Totals total(List<AccountRow> rows) {
        return new Totals(
                rows.stream().mapToLong(AccountRow::calls).sum(),
                rows.stream().mapToLong(AccountRow::inputTokens).sum(),
                rows.stream().mapToLong(AccountRow::outputTokens).sum(),
                rows.stream().mapToLong(AccountRow::costMicros).sum());
    }

}
