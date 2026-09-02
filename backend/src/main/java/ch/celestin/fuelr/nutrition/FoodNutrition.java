package ch.celestin.fuelr.nutrition;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;

/** One reference food, per 100 g / 100 ml. */
@Entity
@Table(name = "food_nutrition")
public class FoodNutrition {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "match_key", nullable = false, unique = true)
    private String matchKey;

    @Column(nullable = false)
    private BigDecimal kcal;

    @Column(name = "protein_g", nullable = false)
    private BigDecimal proteinG;

    @Column(name = "carbs_g", nullable = false)
    private BigDecimal carbsG;

    @Column(name = "fat_g", nullable = false)
    private BigDecimal fatG;

    /**
     * Which aisle it is found in. It lives here because this table is already
     * what turns "200 g de lentilles corail" into a known food — one lookup,
     * and one place to be wrong about what a name means.
     */
    @Column(nullable = false)
    private String aisle;

    protected FoodNutrition() {
    }

    public Long getId() {
        return id;
    }

    public String getMatchKey() {
        return matchKey;
    }

    public double getKcal() {
        return kcal.doubleValue();
    }

    public double getProteinG() {
        return proteinG.doubleValue();
    }

    public double getCarbsG() {
        return carbsG.doubleValue();
    }

    public double getFatG() {
        return fatG.doubleValue();
    }

    public String getAisle() {
        return aisle;
    }
}
