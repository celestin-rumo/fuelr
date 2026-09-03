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
    FULL_HISTORY(Tier.PLUS),

    /**
     * Reading a photo, a screenshot or an unreadable page with a model.
     *
     * Metered: every call is billed to us by the provider, per token. That is
     * what makes it different from every other line in this enum — the others
     * cost the same whether one person uses them or a thousand.
     */
    AI_IMPORT(Tier.PLUS, true),

    /**
     * Estimating a photographed plate.
     *
     * Its own line rather than a corner of AI_IMPORT: writing the diary is
     * free and always has been, and what is paid for here is the camera doing
     * the typing — a different promise, sold separately if it ever comes to
     * that.
     */
    AI_MEAL_PHOTO(Tier.PLUS, true);

    private final Tier required;
    private final boolean metered;

    Feature(Tier required) {
        this(required, false);
    }

    Feature(Tier required, boolean metered) {
        this.required = required;
        this.metered = metered;
    }

    public Tier required() {
        return required;
    }

    /**
     * Whether using this costs money outside our own servers.
     *
     * A metered feature is never opened by the launch period: giving away
     * something that is billed per call is not a gesture, it is a bill.
     */
    public boolean metered() {
        return metered;
    }
}
