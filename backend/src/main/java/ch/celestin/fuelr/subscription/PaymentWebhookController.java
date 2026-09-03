package ch.celestin.fuelr.subscription;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Where a payment provider says it has been paid.
 *
 * Necessarily public: the provider's servers call it, and they have no session.
 * That makes it the one endpoint in the app where an anonymous request can open
 * a paid feature, so it is written to refuse by default and to accept only what
 * the provider itself vouches for.
 *
 * Three refusals, in order. No provider takes money yet, so this answers 501
 * and reads nothing. A delivery whose signature does not check out is a 400 —
 * not a 401, because nothing here is about an account. And an order that is
 * already paid settles again to the same subscription, because providers retry
 * and a second delivery must not buy a second month.
 */
@RestController
@RequestMapping("/api/subscription/webhook")
public class PaymentWebhookController {

    private static final Logger log = LoggerFactory.getLogger(PaymentWebhookController.class);

    private final SubscriptionService subscriptions;

    public PaymentWebhookController(SubscriptionService subscriptions) {
        this.subscriptions = subscriptions;
    }

    @PostMapping
    public ResponseEntity<Void> deliver(
            @RequestHeader(name = "X-Signature", required = false) String signature,
            @RequestBody(required = false) String payload) {
        if (!subscriptions.provider().takesPayment()) {
            // Not an error on the caller's side: nothing here is wired yet, and
            // saying so is more useful than a 404 that looks like a typo.
            return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
        }
        return subscriptions.settle(signature, payload == null ? "" : payload)
                .map(subscription -> ResponseEntity.noContent().<Void>build())
                .orElseGet(() -> {
                    // Worth an operator's attention: either somebody is
                    // guessing, or a real delivery is being rejected.
                    log.warn("A webhook delivery was refused: the signature did not check out.");
                    return ResponseEntity.badRequest().build();
                });
    }
}
