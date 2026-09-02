package ch.celestin.fuelr.subscription;

/**
 * Everything the free plan does not include, and the tier that opens it.
 *
 * This enum is the only place the paid/free boundary is written down. A feature
 * is added here and checked through {@link Entitlements}; nowhere else may
 * compare a tier, or the boundary starts disagreeing with itself and the
 * pricing page becomes a claim rather than a description.
 */
public enum Feature {
    /** One plan, several accounts. What the Famille plan is for. */
    HOUSEHOLD_SHARING(Tier.FAMILY),

    /** Macros and micronutrients past the energy every plan shows. */
    NUTRITION_DETAIL(Tier.PLUS),

    /** Targets, the week's gap against them, and the charts that read it. */
    NUTRITION_TRACKING(Tier.PLUS),

    /** History further back than the free plan's sliding window. */
    FULL_HISTORY(Tier.PLUS);

    private final Tier required;

    Feature(Tier required) {
        this.required = required;
    }

    public Tier required() {
        return required;
    }
}
