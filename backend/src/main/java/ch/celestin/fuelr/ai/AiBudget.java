package ch.celestin.fuelr.ai;

import ch.celestin.fuelr.subscription.Entitlements;
import ch.celestin.fuelr.subscription.Tier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

/**
 * What a month of assisted reading may cost us, per account.
 *
 * A budget in money rather than a count of calls, because the calls are not
 * the same size: a two-page recipe costs twice a one-page one and should say
 * so, a price change does not silently double what everybody gets, and a new
 * kind of read needs no new counter. The provider returns the tokens it
 * counted, so what is decremented is what was actually spent — never an
 * estimate made before the call.
 *
 * It is a ceiling on our own exposure, not a product feature. A plan sold at
 * 6.90 pays for a few dozen readings, and somebody who wants more is a
 * conversation to have rather than an invoice to absorb quietly.
 */
@Service
public class AiBudget {

    /** Raised when this month's budget is spent. */
    public static class ExhaustedException extends RuntimeException {
        private final long spentMicros;
        private final long budgetMicros;

        public ExhaustedException(long spentMicros, long budgetMicros) {
            super("ai_budget_exhausted");
            this.spentMicros = spentMicros;
            this.budgetMicros = budgetMicros;
        }

        public long spentMicros() {
            return spentMicros;
        }

        public long budgetMicros() {
            return budgetMicros;
        }
    }

    private static final long MICROS_PER_CENT = 10_000L;

    private final AiUsageRepository usage;
    private final Entitlements entitlements;

    /** US cents per month, per tier. Cents because that is how it is billed. */
    private final long plusCents;
    private final long familyCents;

    /** Dollars per million tokens, as the provider's price list states them. */
    private final double inputPerMillion;
    private final double outputPerMillion;

    public AiBudget(
            AiUsageRepository usage,
            Entitlements entitlements,
            @Value("${app.ai.budget.plus-cents:100}") long plusCents,
            @Value("${app.ai.budget.family-cents:200}") long familyCents,
            @Value("${app.ai.price.input-per-million:3.00}") double inputPerMillion,
            @Value("${app.ai.price.output-per-million:15.00}") double outputPerMillion) {
        this.usage = usage;
        this.entitlements = entitlements;
        this.plusCents = plusCents;
        this.familyCents = familyCents;
        this.inputPerMillion = inputPerMillion;
        this.outputPerMillion = outputPerMillion;
    }

    /** Before any call this app has ever made — "since the start", as a date. */
    public static final LocalDate BEGINNING = LocalDate.of(1970, 1, 1);

    /** The month a call belongs to, which is the month it happened in. */
    public static LocalDate period() {
        return LocalDate.now().withDayOfMonth(1);
    }

    public long budgetMicros(Long userId) {
        Tier tier = entitlements.tierOf(userId);
        long cents = tier.atLeast(Tier.FAMILY) ? familyCents
                : tier.atLeast(Tier.PLUS) ? plusCents
                : 0;
        return cents * MICROS_PER_CENT;
    }

    public long spentMicros(Long userId) {
        return usage.spentIn(userId, period());
    }

    /**
     * Refuses before the call rather than after.
     *
     * The check is on what has already been spent, so one read can carry the
     * month slightly past its ceiling — the alternative is to guess a price
     * beforehand, which is the thing this class exists not to do. One read of
     * slack is cheaper than a wrong estimate applied to every one of them.
     */
    public void require(Long userId) {
        long budget = budgetMicros(userId);
        long spent = spentMicros(userId);
        if (spent >= budget) {
            throw new ExhaustedException(spent, budget);
        }
    }

    /** Micro-dollars, from the tokens the provider says it counted. */
    public long costOf(long inputTokens, long outputTokens) {
        double dollars = inputTokens * inputPerMillion / 1_000_000d
                + outputTokens * outputPerMillion / 1_000_000d;
        return Math.round(dollars * 1_000_000d);
    }

    /**
     * Its own transaction, on purpose.
     *
     * The provider has been paid by the time this is called. If the draft
     * built afterwards fails — a photo of a blank page produces nothing — the
     * import rolls back, and the money must not roll back with it.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public AiUsage record(Long userId, String operation, String provider,
                          long inputTokens, long outputTokens) {
        return usage.save(new AiUsage(
                userId, period(), operation, provider,
                inputTokens, outputTokens, costOf(inputTokens, outputTokens)));
    }
}
