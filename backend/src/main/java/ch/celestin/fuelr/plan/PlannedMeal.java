package ch.celestin.fuelr.plan;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;

/**
 * One recipe placed on one day, in one slot, for a number of people.
 *
 * It references the recipe rather than copying it: the plan is about a meal
 * that has not been cooked yet, so it should follow the recipe as it is
 * corrected. Only the servings are stored here, because they belong to this
 * evening and not to the recipe.
 */
@Entity
@Table(name = "planned_meals")
public class PlannedMeal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "recipe_id", nullable = false)
    private Long recipeId;

    @Column(name = "meal_date", nullable = false)
    private LocalDate date;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MealSlot slot;

    @Column(nullable = false)
    private int position;

    @Column(nullable = false)
    private int servings;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    protected PlannedMeal() {
    }

    public PlannedMeal(Long userId, Long recipeId, LocalDate date, MealSlot slot,
                       int position, int servings) {
        this.userId = userId;
        this.recipeId = recipeId;
        this.date = date;
        this.slot = slot;
        this.position = position;
        this.servings = servings;
    }

    @PreUpdate
    void touch() {
        this.updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public Long getRecipeId() {
        return recipeId;
    }

    public LocalDate getDate() {
        return date;
    }

    public void setDate(LocalDate date) {
        this.date = date;
    }

    public MealSlot getSlot() {
        return slot;
    }

    public void setSlot(MealSlot slot) {
        this.slot = slot;
    }

    public int getPosition() {
        return position;
    }

    public void setPosition(int position) {
        this.position = position;
    }

    public int getServings() {
        return servings;
    }

    public void setServings(int servings) {
        this.servings = servings;
    }
}
