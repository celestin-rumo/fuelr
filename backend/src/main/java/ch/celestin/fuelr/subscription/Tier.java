package ch.celestin.fuelr.subscription;

/**
 * The three plans the pricing page sells: Cuisine, Fuelr Plus, Famille.
 *
 * The order is the whole point — an entitlement asks "is this account at least
 * FAMILY", never "is it exactly FAMILY", so adding a tier above an existing one
 * cannot silently take a feature away from the people who already had it.
 */
public enum Tier {
    FREE,
    PLUS,
    FAMILY;

    public boolean atLeast(Tier required) {
        return ordinal() >= required.ordinal();
    }

    static Tier parse(String value) {
        try {
            return valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new IllegalArgumentException("unknown_tier");
        }
    }
}
