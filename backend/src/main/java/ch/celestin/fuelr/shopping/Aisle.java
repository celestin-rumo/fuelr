package ch.celestin.fuelr.shopping;

/**
 * Where a thing is found in a shop.
 *
 * Declared in the order a supermarket is walked, and the list is grouped in
 * that order — the point of grouping is to stop crossing the shop twice, which
 * an alphabetical order would not do.
 */
public enum Aisle {
    PRODUCE,
    BAKERY,
    MEAT_FISH,
    DAIRY,
    FROZEN,
    GROCERY,
    HOUSEHOLD,
    /** Anything the reference table does not know, free items included. */
    OTHER;

    public static Aisle parse(String value) {
        if (value == null) return OTHER;
        try {
            return valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return OTHER;
        }
    }
}
