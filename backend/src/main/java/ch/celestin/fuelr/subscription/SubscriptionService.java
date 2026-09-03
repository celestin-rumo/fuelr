package ch.celestin.fuelr.subscription;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
public class SubscriptionService {

    /** Marks a subscription that nobody paid for. */
    static final String GRANTED = "granted";

    private final SubscriptionRepository subscriptions;
    private final SubscriptionOrderRepository orders;

    /**
     * Every provider this build knows about, in `@Order`, ending with the one
     * that takes no money. The first that can actually be paid is the one used
     * — which is how wiring a real provider changes behaviour without changing
     * a line here.
     */
    private final List<PaymentProvider> providers;

    /** Where a customer comes back to after paying, wherever that ends up. */
    private final String siteUrl;

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
            List<PaymentProvider> providers,
            @Value("${app.site-url}") String siteUrl,
            @Value("${app.subscription.self-activate:false}") boolean selfActivate) {
        this.subscriptions = subscriptions;
        this.orders = orders;
        this.providers = providers;
        this.siteUrl = siteUrl;
        this.selfActivate = selfActivate;
    }

    /** The provider in use, which today is the one that refuses politely. */
    public PaymentProvider provider() {
        return providers.stream()
                .filter(PaymentProvider::takesPayment)
                .findFirst()
                .orElse(providers.get(providers.size() - 1));
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
        return selfActivate || provider().takesPayment();
    }

    /**
     * Records that someone asked for a plan.
     *
     * The order is written first and always, whether or not anything can settle
     * it — an order that could not be paid is the only evidence that the demand
     * was there. Then the provider is asked for a checkout, and gives none
     * while none can take money, which leaves the row PENDING and the answer
     * honest about it.
     */
    @Transactional
    public Ordered order(Long userId, Tier tier, BillingPeriod period) {
        if (tier == Tier.FREE) {
            throw new IllegalArgumentException("free_is_not_ordered");
        }
        SubscriptionOrder order = orders.save(new SubscriptionOrder(userId, tier, period));

        PaymentProvider provider = provider();
        Optional<PaymentProvider.Checkout> checkout =
                provider.checkout(order, siteUrl + "/app/household");
        checkout.ifPresent(open -> {
            // The reference is written before the customer leaves for the
            // checkout, because the webhook may well arrive before they do.
            order.awaitPayment(provider.name(), open.reference());
            orders.save(order);
        });

        if (selfActivate) {
            confirm(order.getId(), GRANTED, null);
        }
        return new Ordered(
                orders.findById(order.getId()).orElse(order),
                checkout.map(PaymentProvider.Checkout::url).orElse(null));
    }

    /** An order, and the checkout to go and pay it at when there is one. */
    public record Ordered(SubscriptionOrder order, String checkoutUrl) {
    }

    /**
     * Settles what a provider says it has been paid.
     *
     * The delivery is handed to the provider first and believed only if it
     * says the signature is genuine: this arrives on a public endpoint, so an
     * unverified payload is somebody claiming to have paid. Empty means
     * exactly that, and the caller answers accordingly.
     */
    @Transactional
    public Optional<Subscription> settle(String signature, String payload) {
        PaymentProvider provider = provider();
        return provider.settle(signature, payload)
                .map(settlement -> confirm(
                        settlement.orderId(), provider.name(), settlement.reference()));
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
