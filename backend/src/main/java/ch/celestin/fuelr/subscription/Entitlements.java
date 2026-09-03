package ch.celestin.fuelr.subscription;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * The one question everything else asks: may this account do that.
 *
 * Nothing outside this class compares tiers. A feature check that read the
 * subscription row itself would keep working while quietly disagreeing with
 * {@link Feature} about where the paid boundary is, and the pricing page would
 * become a claim instead of a description.
 */
@Service
public class Entitlements {

    /** Raised when a paid feature is used by an account that has not paid. */
    public static class NotEntitledException extends RuntimeException {
        private final Feature feature;

        public NotEntitledException(Feature feature) {
            super("upgrade_required");
            this.feature = feature;
        }

        public Feature feature() {
            return feature;
        }

        public Tier required() {
            return feature.required();
        }
    }

    private final SubscriptionRepository subscriptions;

    /**
     * Whether the paid boundary is being enforced at all.
     *
     * Off, every feature is open to every account: that is the launch period,
     * where the plans are described and nothing is charged. On, {@link Feature}
     * decides as it always has. It is one flag in one method on purpose — a
     * second place deciding whether something is free is a second place to
     * disagree with the pricing page.
     *
     * Turning it on takes nothing away that was paid for: an account that
     * ordered a plan keeps it, and one that never did falls back to what the
     * free plan has always included. The household is the delicate case, and
     * it is already handled — a member whose owner is no longer entitled falls
     * back to their own plan, which was there the whole time.
     */
    private final boolean enforced;

    public Entitlements(
            SubscriptionRepository subscriptions,
            @Value("${app.subscription.enforce:false}") boolean enforced) {
        this.subscriptions = subscriptions;
        this.enforced = enforced;
    }

    /** True while everything is free — the screens say so rather than pretend. */
    public boolean openPeriod() {
        return !enforced;
    }

    /** An account with no row has never subscribed, which is FREE. */
    public Tier tierOf(Long userId) {
        return subscriptions.findByUserId(userId)
                .map(Subscription::tierNow)
                .orElse(Tier.FREE);
    }

    public boolean has(Long userId, Feature feature) {
        // The launch period opens everything, metered features included.
        //
        // It did hold those back for a while, on the grounds that giving away
        // something billed per call is not a gesture but a bill. That was the
        // wrong instrument: nobody can subscribe yet, so the exception did not
        // protect a margin — it made the feature unreachable for everybody,
        // including the people the launch is for.
        //
        // What a metered feature costs is capped instead, per account and per
        // month, by AiBudget. A ceiling in money is the right shape for that
        // risk: it bounds the loss from a stranger without being a paywall in
        // front of a cook. `Feature.metered()` still says which features carry
        // that cost — it is now read by the budget rather than by this check.
        if (!enforced) {
            return true;
        }
        return tierOf(userId).atLeast(feature.required());
    }

    public void require(Long userId, Feature feature) {
        if (!has(userId, feature)) {
            throw new NotEntitledException(feature);
        }
    }
}
