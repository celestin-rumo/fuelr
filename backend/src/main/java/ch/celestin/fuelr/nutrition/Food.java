package ch.celestin.fuelr.nutrition;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;

/**
 * One reference food, per 100 g / 100 ml.
 *
 * Imported from a published composition table rather than typed here — see
 * {@link FoodTableImporter} and `tools/food-table/build.py`. Everything except
 * the energy is nullable, because a published table says "not measured" by
 * leaving a cell empty, and a zero would be a different and false claim.
 */
@Entity
@Table(name = "foods")
public class Food {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String source;

    @Column(name = "source_ref", nullable = false)
    private String sourceRef;

    @Column
    private String category;

    @Column(nullable = false)
    private String aisle;

    @Column(nullable = false)
    private BigDecimal kcal;

    @Column(name = "protein_g")
    private BigDecimal proteinG;

    @Column(name = "carbs_g")
    private BigDecimal carbsG;

    @Column(name = "fat_g")
    private BigDecimal fatG;

    @Column(name = "fibre_g")
    private BigDecimal fibreG;

    @Column(name = "sugars_g")
    private BigDecimal sugarsG;

    @Column(name = "salt_g")
    private BigDecimal saltG;

    protected Food() {
    }

    public Food(String source, String sourceRef) {
        this.source = source;
        this.sourceRef = sourceRef;
    }

    public Long getId() {
        return id;
    }

    public String getSourceRef() {
        return sourceRef;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getAisle() {
        return aisle;
    }

    public void setAisle(String aisle) {
        this.aisle = aisle;
    }

    /** Energy is the one value every screen asks for, so it is never null. */
    public double getKcal() {
        return kcal.doubleValue();
    }

    public void setKcal(BigDecimal kcal) {
        this.kcal = kcal;
    }

    /** Null means the source did not measure it, which is not the same as zero. */
    public Double getProteinG() {
        return proteinG == null ? null : proteinG.doubleValue();
    }

    public Double getCarbsG() {
        return carbsG == null ? null : carbsG.doubleValue();
    }

    public Double getFatG() {
        return fatG == null ? null : fatG.doubleValue();
    }

    public Double getFibreG() {
        return fibreG == null ? null : fibreG.doubleValue();
    }

    public Double getSugarsG() {
        return sugarsG == null ? null : sugarsG.doubleValue();
    }

    public Double getSaltG() {
        return saltG == null ? null : saltG.doubleValue();
    }

    public void setMacros(BigDecimal protein, BigDecimal carbs, BigDecimal fat,
                          BigDecimal fibre, BigDecimal sugars, BigDecimal salt) {
        this.proteinG = protein;
        this.carbsG = carbs;
        this.fatG = fat;
        this.fibreG = fibre;
        this.sugarsG = sugars;
        this.saltG = salt;
    }
}
