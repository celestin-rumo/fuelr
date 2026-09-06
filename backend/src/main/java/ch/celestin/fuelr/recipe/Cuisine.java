package ch.celestin.fuelr.recipe;

import java.util.Arrays;
import java.util.List;

/**
 * The cuisine a recipe belongs to — at most one.
 *
 * A closed domain rather than a tag, for the reason `Season` is one: "fill my
 * week with Italian food" has to be computable, and it is not if the value is
 * whatever somebody typed. This application has already paid for that lesson
 * once, when an imported recipe tagged "soupe" became a recipe no filter could
 * find.
 *
 * At most one, unlike a season: a dish is not of two cuisines at a time, and
 * "none" is the common case rather than a gap somebody forgot to fill.
 *
 * The list is deliberately short. Every entry here is a filter chip somebody
 * has to read past, and a cuisine nobody cooks is a chip that costs everybody
 * and serves nobody. It grows when a real library asks for it.
 */
public enum Cuisine {
    ITALIAN,
    FRENCH,
    SWISS,
    SPANISH,
    GREEK,
    LEBANESE,
    MOROCCAN,
    INDIAN,
    THAI,
    CHINESE,
    JAPANESE,
    MEXICAN;

    /** What a model may answer, so it is never asked without being told. */
    public static List<String> names() {
        return Arrays.stream(values()).map(Enum::name).toList();
    }

    /**
     * Parses a cuisine, answering null for anything that is not one.
     *
     * Null rather than an exception: this reads what a model or an import
     * produced, and a value outside the domain is a value to drop, not a
     * request to fail. The recipe keeps everything else.
     */
    public static Cuisine parseOrNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
