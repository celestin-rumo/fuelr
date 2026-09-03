package ch.celestin.fuelr.subscription;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;

/**
 * What the plans cost and what is being charged for today.
 *
 * Public, because the pricing page is: somebody comparing plans has no account
 * yet, and asking them to make one to see a price would be the oldest bad
 * pattern on the web. Nothing here is about an account — it is the same answer
 * for everybody.
 */
@RestController
@RequestMapping("/api/plans")
public class PlansController {

    /**
     * One plan as the pricing page needs it.
     *
     * {@code features} is what the plan opens, named the way {@link Feature}
     * names it, so the page can describe a plan without a second list going
     * quietly out of step with the enum that decides.
     */
    public record PlanView(
            String tier,
            BigDecimal monthly,
            BigDecimal yearly,
            List<String> features) {
    }

    /**
     * {@code openPeriod} is what makes the page honest: while it is true every
     * feature is open to everybody and nothing is charged, and the page says
     * so instead of showing crosses beside things that work.
     */
    public record PlansView(
            String currency,
            boolean openPeriod,
            boolean canOrder,
            List<PlanView> plans) {
    }

    private final PlanCatalogue catalogue;
    private final SubscriptionService subscriptions;
    private final Entitlements entitlements;

    public PlansController(
            PlanCatalogue catalogue, SubscriptionService subscriptions, Entitlements entitlements) {
        this.catalogue = catalogue;
        this.subscriptions = subscriptions;
        this.entitlements = entitlements;
    }

    @GetMapping
    public PlansView plans() {
        List<PlanView> plans = Arrays.stream(Tier.values())
                .map(tier -> new PlanView(
                        tier.name(),
                        catalogue.of(tier).getMonthly(),
                        catalogue.of(tier).getYearly(),
                        Arrays.stream(Feature.values())
                                .filter(feature -> tier.atLeast(feature.required()))
                                .map(Enum::name)
                                .toList()))
                .toList();
        return new PlansView(
                catalogue.getCurrency(),
                entitlements.openPeriod(),
                subscriptions.canOrder(),
                plans);
    }
}
