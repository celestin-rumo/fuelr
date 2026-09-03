package ch.celestin.fuelr.subscription;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * The provider that exists while none does.
 *
 * It refuses in both directions and lies about neither: no checkout comes back,
 * so `canOrder` is false and the screen says the plan is not open yet, and no
 * webhook delivery is ever accepted, so the one public endpoint that could
 * grant a subscription grants none.
 *
 * Ordered last, which is the seam: the providers are injected as a list and
 * the first one that can actually be paid wins, so this is what is left when
 * none can. Adding a real provider is adding one `@Component` — the same way
 * a recipe parser is added, and for the same reason.
 */
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
public class NoPaymentProvider implements PaymentProvider {

    @Override
    public String name() {
        return "none";
    }

    @Override
    public boolean takesPayment() {
        return false;
    }

    @Override
    public Optional<Checkout> checkout(SubscriptionOrder order, String returnUrl) {
        return Optional.empty();
    }

    @Override
    public Optional<Settlement> settle(String signature, String payload) {
        return Optional.empty();
    }
}
