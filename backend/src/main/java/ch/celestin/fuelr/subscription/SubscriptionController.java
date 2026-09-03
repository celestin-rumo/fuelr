package ch.celestin.fuelr.subscription;

import ch.celestin.fuelr.subscription.SubscriptionDtos.OrderRequest;
import ch.celestin.fuelr.subscription.SubscriptionDtos.OrderView;
import ch.celestin.fuelr.subscription.SubscriptionDtos.SubscriptionView;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/api/subscription")
public class SubscriptionController {

    private final SubscriptionService subscriptions;
    private final Entitlements entitlements;

    public SubscriptionController(SubscriptionService subscriptions, Entitlements entitlements) {
        this.subscriptions = subscriptions;
        this.entitlements = entitlements;
    }

    @GetMapping
    public SubscriptionView mine(@AuthenticationPrincipal Jwt principal) {
        return view(userId(principal));
    }

    /**
     * Asks for a plan. 202, not 201: the order is accepted and nothing has been
     * paid — which stays true when a provider is wired and the answer carries a
     * checkout to go and pay at.
     */
    @PostMapping("/orders")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public OrderView order(
            @AuthenticationPrincipal Jwt principal,
            @Valid @RequestBody OrderRequest body) {
        try {
            SubscriptionService.Ordered placed = subscriptions.order(
                    userId(principal),
                    Tier.parse(body.tier()),
                    body.period() == null ? BillingPeriod.MONTHLY : BillingPeriod.parse(body.period()));
            SubscriptionOrder order = placed.order();
            return new OrderView(
                    order.getId(), order.getTier().name(), order.getPeriod().name(),
                    order.getStatus().name(),
                    // Null while no provider takes money, which is the state
                    // the screen already knows how to say out loud.
                    placed.checkoutUrl());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    /** Ends the plan and keeps every row it ever unlocked. */
    @DeleteMapping
    public SubscriptionView cancel(@AuthenticationPrincipal Jwt principal) {
        Long userId = userId(principal);
        subscriptions.cancel(userId);
        return view(userId);
    }

    private SubscriptionView view(Long userId) {
        Tier tier = entitlements.tierOf(userId);
        // What the account may do, asked the way every screen asks it. During
        // the launch period that is every feature, whatever the tier says.
        List<String> features = Arrays.stream(Feature.values())
                .filter(feature -> entitlements.has(userId, feature))
                .map(Enum::name)
                .toList();
        return subscriptions.find(userId)
                .map(subscription -> new SubscriptionView(
                        tier.name(), subscription.getStatus().name(),
                        subscription.getPeriod().name(), subscription.getCurrentPeriodEnd(),
                        features, subscriptions.canOrder(), entitlements.openPeriod()))
                .orElseGet(() -> new SubscriptionView(
                        tier.name(), Subscription.Status.CANCELED.name(),
                        BillingPeriod.MONTHLY.name(), null, features,
                        subscriptions.canOrder(), entitlements.openPeriod()));
    }

    private static Long userId(Jwt principal) {
        return Long.valueOf(principal.getSubject());
    }
}
