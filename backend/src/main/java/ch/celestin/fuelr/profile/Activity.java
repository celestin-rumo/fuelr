package ch.celestin.fuelr.profile;

/** The usual five activity factors applied to a basal rate. */
public enum Activity {
    SEDENTARY(1.2),
    LIGHT(1.375),
    MODERATE(1.55),
    ACTIVE(1.725),
    VERY_ACTIVE(1.9);

    private final double factor;

    Activity(double factor) {
        this.factor = factor;
    }

    public double factor() {
        return factor;
    }
}
