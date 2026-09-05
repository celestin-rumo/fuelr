package ch.celestin.fuelr.admin;

import ch.celestin.fuelr.account.UserRepository;
import ch.celestin.fuelr.subscription.PlanCatalogue;
import ch.celestin.fuelr.subscription.SubscriptionOrderRepository;
import ch.celestin.fuelr.subscription.SubscriptionRepository;
import ch.celestin.fuelr.subscription.Tier;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;

/**
 * The two questions that are answered by counting, not by asking anybody.
 *
 * **Subscriptions** — how many accounts on each tier, how many plans are still
 * running after a cancellation, and how many orders are stuck as PENDING.
 * That last number is the interesting one right now: no provider is wired, so
 * a PENDING order is somebody who tried to pay and could not. It is the only
 * evidence that demand exists.
 *
 * **Usage** — what is actually being used, counted from the tables that
 * already hold the answers. `recipes.source_url` separates an import from a
 * typed recipe, `meal_log.source` separates a cooked meal from a hand-written
 * one, `ai_usage.operation` separates the readings. Counting what is already
 * there beats instrumenting the application with events, and adds no personal
 * data to a system that says on its privacy page it collects none.
 *
 * Nothing in the usage section is nominative. Totals and the share of accounts
 * that used something at least once — never who. The detail per account has
 * its own section, behind the same door, where somebody arrived with a reason.
 */
@RestController
@RequestMapping("/api/admin")
public class AdminMetricsController {

    public record TierRow(String tier, long accounts, long activeSubscriptions) {
    }

    public record MonthRow(String month, long started, long cancelled) {
    }

    public record SubscriptionReport(
            long accounts,
            List<TierRow> tiers,
            long active,
            long cancelled,
            /** Cancelled, but the period they paid for has not run out. */
            long cancelledStillRunning,
            /** Somebody tried to pay and could not. */
            long ordersPending,
            long ordersPaid,
            List<MonthRow> months,
            /**
             * What the active plans would bill in a month, in the currency the
             * prices are in.
             *
             * Named "committed" and not "revenue" on purpose: nothing has been
             * collected. No payment provider is wired, so every subscription
             * here was granted rather than bought, and showing a theoretical
             * figure as though it had been received is how a dashboard starts
             * lying. The real number arrives with the provider.
             */
            long monthlyCommittedCents,
            String currency,
            boolean anyPaymentEverCollected) {
    }

    public record CountRow(String what, long total, long thisMonth, long accountsUsing) {
    }

    public record UsageReport(long accounts, List<CountRow> counts) {
    }

    private final AdminAccess access;
    private final UserRepository users;
    private final SubscriptionRepository subscriptions;
    private final SubscriptionOrderRepository orders;
    private final PlanCatalogue plans;
    private final EntityManager db;
    private final boolean enforced;

    public AdminMetricsController(
            AdminAccess access, UserRepository users,
            SubscriptionRepository subscriptions, SubscriptionOrderRepository orders,
            PlanCatalogue plans, EntityManager db,
            @Value("${app.subscription.enforce:true}") boolean enforced) {
        this.access = access;
        this.users = users;
        this.subscriptions = subscriptions;
        this.orders = orders;
        this.plans = plans;
        this.db = db;
        this.enforced = enforced;
    }

    @GetMapping("/subscriptions")
    public SubscriptionReport subscriptionReport(@AuthenticationPrincipal Jwt principal) {
        access.require(principal);

        long accounts = users.count();
        long onPaidTier = count("select count(*) from subscriptions where status = 'ACTIVE'");

        List<TierRow> tiers = new ArrayList<>();
        for (Tier tier : Tier.values()) {
            long active = tier == Tier.FREE ? 0 : count(
                    "select count(*) from subscriptions where status = 'ACTIVE' and tier = :t",
                    "t", tier.name());
            tiers.add(new TierRow(
                    tier.name(),
                    tier == Tier.FREE ? accounts - onPaidTier : active,
                    active));
        }

        long collected = count(
                "select count(*) from subscription_orders where status = 'PAID' and provider <> 'granted'");

        return new SubscriptionReport(
                accounts,
                tiers,
                onPaidTier,
                count("select count(*) from subscriptions where status = 'CANCELED'"),
                count("""
                        select count(*) from subscriptions
                        where status = 'CANCELED' and current_period_end > now()"""),
                count("select count(*) from subscription_orders where status = 'PENDING'"),
                count("select count(*) from subscription_orders where status = 'PAID'"),
                months(),
                committedCents(),
                plans.getCurrency(),
                collected > 0);
    }

    @GetMapping("/usage")
    public UsageReport usageReport(@AuthenticationPrincipal Jwt principal) {
        access.require(principal);

        // Each table names its own account column and its own timestamp: a
        // planned meal is `created_by`, a shopping list belongs to a household,
        // and a pantry item only ever recorded when it was last touched. Both
        // are parameters rather than assumptions, because guessing here
        // produces a query that fails at runtime and only in production.
        List<CountRow> counts = List.of(
                counted("Recipes written", "recipes", "user_id", "created_at",
                        "source_url is null"),
                counted("Recipes imported from a link", "recipes", "user_id", "created_at",
                        "source_url is not null"),
                counted("Recipes still in draft", "recipes", "user_id", "created_at",
                        "status = 'DRAFT'"),
                counted("Recipes with a photograph", "recipes", "user_id", "created_at",
                        "photo_path is not null"),
                counted("Planned meals", "planned_meals", "created_by", "created_at", null),
                counted("Shopping lists", "shopping_lists", "household_id", "generated_at", null),
                counted("Meals logged from a recipe", "meal_log", "user_id", "created_at",
                        "source = 'RECIPE'"),
                counted("Meals written down by hand", "meal_log", "user_id", "created_at",
                        "source = 'MANUAL'"),
                counted("Pantry shelves kept", "pantry_items", "household_id", "updated_at", null),
                counted("Nutrition targets set", "nutrition_targets", "user_id", "updated_at", null),
                counted("Assisted readings", "ai_usage", "user_id", "created_at", null),
                counted("Accounts inside a shared household", "household_members",
                        "user_id", "joined_at", null));

        return new UsageReport(users.count(), counts);
    }

    // --- counting -----------------------------------------------------------

    /**
     * Accounts per tier, month by month, from the orders rather than the
     * subscriptions: a subscription row holds only its current state, so it
     * cannot say when anything started. `subscription_orders` keeps one row
     * per event, which is what makes a history possible at all.
     */
    private List<MonthRow> months() {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = db.createNativeQuery("""
                select to_char(month, 'YYYY-MM') as m,
                       sum(started) as started,
                       sum(cancelled) as cancelled
                from (
                    select date_trunc('month', created_at) as month,
                           count(*) filter (where status = 'PAID') as started,
                           0 as cancelled
                    from subscription_orders
                    group by 1
                    union all
                    select date_trunc('month', updated_at), 0,
                           count(*) filter (where status = 'CANCELED')
                    from subscriptions
                    group by 1
                ) events
                group by month
                order by month desc
                limit 12
                """).getResultList();

        return rows.stream()
                .map(row -> new MonthRow(
                        (String) row[0],
                        ((Number) row[1]).longValue(),
                        ((Number) row[2]).longValue()))
                .toList();
    }

    /** What the active plans add up to per month, at today's prices. */
    private long committedCents() {
        long total = 0;
        for (Tier tier : Tier.values()) {
            if (tier == Tier.FREE) {
                continue;
            }
            long active = count(
                    "select count(*) from subscriptions where status = 'ACTIVE' and tier = :t",
                    "t", tier.name());
            java.math.BigDecimal monthly = plans.of(tier).getMonthly();
            if (monthly == null) {
                continue;
            }
            // In cents, because a monthly price in francs times a count of
            // accounts is exactly the arithmetic that goes wrong in binary
            // floating point.
            total += active * monthly.movePointRight(2).longValueExact();
        }
        return total;
    }

    /**
     * One line of the usage table.
     *
     * `accountsUsing` counts distinct accounts rather than rows, because "1200
     * recipes" and "1200 recipes written by one person" are different products.
     *
     * Nothing here is nominative: three numbers per line and no identity. The
     * privacy page says this application runs no analytics, and that stays
     * true — these are counts of rows the database already holds, not events
     * anybody was instrumented to produce.
     */
    private CountRow counted(String what, String table, String accountColumn,
                             String timeColumn, String where) {
        String clause = where == null ? "" : " and " + where;
        return new CountRow(
                what,
                count("select count(*) from " + table + " where true" + clause),
                count("select count(*) from " + table
                      + " where " + timeColumn + " >= date_trunc('month', now())" + clause),
                count("select count(distinct " + accountColumn + ") from " + table
                      + " where " + accountColumn + " is not null" + clause));
    }

    private long count(String sql) {
        return ((Number) db.createNativeQuery(sql).getSingleResult()).longValue();
    }

    private long count(String sql, String name, Object value) {
        return ((Number) db.createNativeQuery(sql)
                .setParameter(name, value)
                .getSingleResult()).longValue();
    }

    /**
     * Whether the paid boundary is on at all.
     *
     * With `app.subscription.enforce` off — which is production today —
     * everybody has everything regardless of tier, so a tier count describes
     * who *ordered* something and not who *can do* anything. The screen says
     * so rather than letting the figure be read as access.
     */
    @GetMapping("/enforcement")
    public Enforcement enforcement(@AuthenticationPrincipal Jwt principal) {
        access.require(principal);
        return new Enforcement(enforced);
    }

    public record Enforcement(boolean enforced) {
    }
}
