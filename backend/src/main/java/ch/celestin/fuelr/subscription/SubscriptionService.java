package ch.celestin.fuelr.subscription;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

@Service
public class SubscriptionService {

    /** Marks a subscription that nobody paid for. */
    static final String GRANTED = "granted";

    private final SubscriptionRepository subscriptions;
    private final SubscriptionOrderRepository orders;

    /**
     * Whether asking for a plan is enough to get it.
     *
     * False everywhere a real person can reach, and it must stay that way: with
     * it on, anyone can hand themselves Famille. It exists for the same reason
     * {@code app.import.allow-private-hosts} does — the tests need to exercise
     * a paid feature, and there is no payment provider to exercise it through
     * yet. When one is wired, this flag goes and the webhook calls
     * {@link #confirm} instead.
     */
    private final boolean selfActivate;

    public SubscriptionService(
            SubscriptionRepository subscriptions,
            SubscriptionOrderRepository orders,
            @Value("${app.subscription.self-activate:false}") boolean selfActivate) {
        this.subscriptions = subscriptions;
        this.orders = orders;
        this.selfActivate = selfActivate;
    }

    public Optional<Subscription> find(Long userId) {
        return subscriptions.findByUserId(userId);
    }

    /**
     * Whether a plan can actually be bought right now.
     *
     * The screen asks before it offers: a button that takes an order nobody can
     * pay is worse than a screen that says the plan is not open yet.
     */
    public boolean canOrder() {
        return selfActivate;
    }

    /**
     * Records that someone asked for a plan.
     *
     * The order is written first and always, whether or not anything can settle
     * it — an order that could not be paid is the only evidence that the demand
     * was there. Where a provider exists, this is where its checkout would be
     * created and its reference stored on the order.
     */
    @Transactional
    public SubscriptionOrder order(Long userId, Tier tier, BillingPeriod period) {
        if (tier == Tier.FREE) {
            throw new IllegalArgumentException("free_is_not_ordered");
        }
        SubscriptionOrder order = orders.save(new SubscriptionOrder(userId, tier, period));
        if (selfActivate) {
            confirm(order.getId(), GRANTED, null);
        }
        return orders.findById(order.getId()).orElse(order);
    }

    /**
     * Settles an order and opens the access.
     *
     * This is the method a payment webhook calls, and the only way a
     * subscription becomes ACTIVE. It is idempotent on purpose: providers
     * retry, and a second delivery of the same event must not extend a
     * subscription by another period.
     */
    @Transactional
    public Subscription confirm(Long orderId, String provider, String providerRef) {
        SubscriptionOrder order = orders.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("unknown_order"));
        Subscription subscription = subscriptions.findByUserId(order.getUserId())
                .orElseGet(() -> new Subscription(order.getUserId()));

        if (order.getStatus() == SubscriptionOrder.Status.PAID) {
            return subscription;
        }

        order.markPaid(provider, providerRef);
        orders.save(order);

        // A granted subscription has no end date: nothing is going to renew it,
        // so nothing should expire it either.
        Instant end = GRANTED.equals(provider)
                ? null
                : order.getPeriod().endFrom(Instant.now());
        subscription.activate(order.getTier(), order.getPeriod(), end, provider, providerRef);
        return subscriptions.save(subscription);
    }

    /**
     * Ends the plan. Nothing is deleted — that is the promise the pricing page
     * makes, and the shared household is the thing it is easiest to break.
     */
    @Transactional
    public Optional<Subscription> cancel(Long userId) {
        return subscriptions.findByUserId(userId).map(subscription -> {
            subscription.cancel();
            return subscriptions.save(subscription);
        });
    }
}
