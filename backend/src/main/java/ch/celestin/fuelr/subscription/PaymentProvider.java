package ch.celestin.fuelr.subscription;

import java.util.Optional;

/**
 * Whoever ends up taking the money.
 *
 * No provider is chosen yet, so this interface is deliberately written in the
 * vocabulary every one of them shares — send the customer somewhere to pay,
 * then be told, over a webhook, that they did — and in nobody's SDK. Stripe,
 * Payrexx and Datatrans all fit behind it, and picking one means writing one
 * class rather than finding every place that assumed the other.
 *
 * The implementation shipped today takes no money at all and says so. That is
 * what makes the rest of the machinery safe to have in place while the plans
 * are free: an order is recorded, no checkout comes back, and the webhook
 * refuses everything.
 */
public interface PaymentProvider {

    /** Where the customer goes to pay, and the id to recognise them by. */
    record Checkout(String url, String reference) {
    }

    /** What a webhook delivery turned out to mean. */
    record Settlement(Long orderId, String reference) {
    }

    /** Goes on the order and into the logs; never shown to a customer. */
    String name();

    /**
     * Whether this provider can actually be paid right now.
     *
     * The screen asks before it offers: a button that takes an order nobody
     * can settle is worse than a screen saying the plan is not open yet.
     */
    boolean takesPayment();

    /**
     * Opens a checkout for an order, or nothing when payment is not possible.
     *
     * Returning empty is a normal answer, not a failure — the order stays
     * PENDING, which is the honest record of a sale that could not be made.
     */
    Optional<Checkout> checkout(SubscriptionOrder order, String returnUrl);

    /**
     * Reads a webhook delivery, and says which order it settles.
     *
     * The signature is the whole of the security here: this endpoint is public
     * by necessity — the provider calls it, not the customer — so anything it
     * cannot prove came from the provider must come back empty. An
     * implementation that skipped this check would hand out subscriptions to
     * anybody who could POST.
     */
    Optional<Settlement> settle(String signature, String payload);
}
