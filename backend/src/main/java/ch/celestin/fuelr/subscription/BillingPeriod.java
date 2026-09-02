package ch.celestin.fuelr.subscription;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

/** How long one paid period lasts. The pricing page offers both. */
public enum BillingPeriod {
    MONTHLY(30),
    YEARLY(365);

    private final int days;

    BillingPeriod(int days) {
        this.days = days;
    }

    public Instant endFrom(Instant start) {
        return start.plus(days, ChronoUnit.DAYS);
    }

    static BillingPeriod parse(String value) {
        try {
            return valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new IllegalArgumentException("unknown_period");
        }
    }
}
