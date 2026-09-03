package ch.celestin.fuelr.log;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * One meal, as eaten.
 *
 * Every figure is copied in at the moment of logging and never read back from
 * the recipe. Recipes get corrected after they have been cooked, and a log
 * that pointed at the live one would quietly rewrite what somebody ate in
 * March because they fixed a typo in June. The recipe id is kept for the
 * record and carries no foreign key: deleting a recipe must leave the history
 * standing.
 */
@Entity
@Table(name = "meal_log")
public class MealLogEntry {

    /** Where the entry came from. Only ever descriptive. */
    public enum Source { PLAN, RECIPE, FREE }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false)
    private String title;

    @Column(name = "meal_date", nullable = false)
    private LocalDate date;

    @Column(nullable = false)
    private String slot;

    @Column(nullable = false)
    private BigDecimal servings;

    @Column(nullable = false)
    private BigDecimal kcal;

    @Column(name = "protein_g", nullable = false)
    private BigDecimal proteinG;

    @Column(name = "carbs_g", nullable = false)
    private BigDecimal carbsG;

    @Column(name = "fat_g", nullable = false)
    private BigDecimal fatG;

    @Column(nullable = false)
    private boolean estimated;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Source source;

    @Column(name = "recipe_id")
    private Long recipeId;

    @Column(name = "planned_meal_id")
    private Long plannedMealId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected MealLogEntry() {
    }

    public MealLogEntry(Long userId, String title, LocalDate date, String slot,
                        BigDecimal servings, BigDecimal kcal, BigDecimal protein,
                        BigDecimal carbs, BigDecimal fat, boolean estimated, Source source) {
        this.userId = userId;
        this.title = title;
        this.date = date;
        this.slot = slot;
        this.servings = servings;
        this.kcal = kcal;
        this.proteinG = protein;
        this.carbsG = carbs;
        this.fatG = fat;
        this.estimated = estimated;
        this.source = source;
    }

    public void from(Long recipeId, Long plannedMealId) {
        this.recipeId = recipeId;
        this.plannedMealId = plannedMealId;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public String getTitle() {
        return title;
    }

    public LocalDate getDate() {
        return date;
    }

    public String getSlot() {
        return slot;
    }

    public double getServings() {
        return servings.doubleValue();
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

    public boolean isEstimated() {
        return estimated;
    }

    public Source getSource() {
        return source;
    }

    public Long getRecipeId() {
        return recipeId;
    }

    public Long getPlannedMealId() {
        return plannedMealId;
    }
}
