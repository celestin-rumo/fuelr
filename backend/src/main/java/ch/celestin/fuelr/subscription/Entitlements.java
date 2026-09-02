package ch.celestin.fuelr.subscription;

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

    public Entitlements(SubscriptionRepository subscriptions) {
        this.subscriptions = subscriptions;
    }

    /** An account with no row has never subscribed, which is FREE. */
    public Tier tierOf(Long userId) {
        return subscriptions.findByUserId(userId)
                .map(Subscription::tierNow)
                .orElse(Tier.FREE);
    }

    public boolean has(Long userId, Feature feature) {
        return tierOf(userId).atLeast(feature.required());
    }

    public void require(Long userId, Feature feature) {
        if (!has(userId, feature)) {
            throw new NotEntitledException(feature);
        }
    }
}
