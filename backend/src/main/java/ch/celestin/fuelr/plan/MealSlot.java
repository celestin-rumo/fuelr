package ch.celestin.fuelr.plan;

/**
 * The four slots of a day. Fixed rather than configurable: the week grid has
 * four rows, and a plan whose shape changed per account could not be read at a
 * glance — which is the only thing the screen is for.
 */
public enum MealSlot {
    BREAKFAST,
    LUNCH,
    DINNER,
    SNACK;

    /** Parses a slot name from a request, refusing anything else. */
    static MealSlot parse(String value) {
        try {
            return valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new IllegalArgumentException("unknown_slot");
        }
    }
}
