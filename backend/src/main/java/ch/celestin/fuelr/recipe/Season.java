package ch.celestin.fuelr.recipe;

import java.time.LocalDate;
import java.time.Month;

/**
 * The four seasons a recipe can belong to.
 *
 * A closed domain rather than a tag: "show me what is in season" has to be
 * derivable from the date, and it cannot be if the value is whatever somebody
 * typed. Zero seasons is the normal case — most dishes are of no season.
 */
public enum Season {
    SPRING,
    SUMMER,
    AUTUMN,
    WINTER;

    /**
     * The season a date falls in, northern hemisphere.
     *
     * That assumption is the app's, not a fact: south of the equator these are
     * exactly wrong. The day Fuelr ships there, this has to follow the account
     * rather than the calendar, which is why it is one method and not an
     * expression scattered across screens.
     */
    public static Season of(LocalDate date) {
        Month month = date.getMonth();
        return switch (month) {
            case MARCH, APRIL, MAY -> SPRING;
            case JUNE, JULY, AUGUST -> SUMMER;
            case SEPTEMBER, OCTOBER, NOVEMBER -> AUTUMN;
            default -> WINTER;
        };
    }

    /** Parses a season name, refusing anything that is not one of the four. */
    public static Season parse(String value) {
        try {
            return valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new IllegalArgumentException("unknown_season");
        }
    }
}
