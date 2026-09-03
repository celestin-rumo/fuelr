package ch.celestin.fuelr.subscription;

import jakarta.validation.constraints.NotBlank;

import java.time.Instant;
import java.util.List;

public final class SubscriptionDtos {

    private SubscriptionDtos() {
    }

    /**
     * What the account may do, said in features rather than in tiers.
     *
     * The screen asks "may I share a household", not "am I FAMILY". That way
     * the boundary can move — a feature can be promoted to the free plan —
     * without every screen having to be found and corrected.
     */
    public record SubscriptionView(
            String tier,
            String status,
            String period,
            Instant currentPeriodEnd,
            List<String> features,
            /** False while no plan can actually be paid for. */
            boolean canOrder,
            /** True while every feature is open and nothing is charged. */
            boolean openPeriod) {
    }

    public record OrderRequest(
            @NotBlank String tier,
            /** Defaults to monthly, which is what the pricing page defaults to. */
            String period) {
    }

    /**
     * {@code checkoutUrl} is null until a payment provider is wired; a pending
     * order with no checkout is the honest state, not an error.
     */
    public record OrderView(
            Long id,
            String tier,
            String period,
            String status,
            String checkoutUrl) {
    }
}
