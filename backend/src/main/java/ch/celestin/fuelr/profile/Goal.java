package ch.celestin.fuelr.profile;

/**
 * How the maintenance figure is shifted.
 *
 * Percentages rather than a flat 500 kcal: the same deficit is gentle for
 * someone burning 3000 and severe for someone burning 1700.
 */
public enum Goal {
    LOSE(-0.20, 2.0),
    MAINTAIN(0.0, 1.8),
    GAIN(0.15, 1.8);

    private final double energyShift;
    private final double proteinPerKg;

    Goal(double energyShift, double proteinPerKg) {
        this.energyShift = energyShift;
        this.proteinPerKg = proteinPerKg;
    }

    public double energyShift() {
        return energyShift;
    }

    /** Protein is set per kilo of body weight, not as a share of energy. */
    public double proteinPerKg() {
        return proteinPerKg;
    }
}
