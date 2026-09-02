package ch.celestin.fuelr.plan;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.List;

public final class PlanDtos {

    private PlanDtos() {
    }

    /**
     * A whole week in one response. The screen shows 7 × 4 = 28 slots at once,
     * so fetching them one by one would be 28 round trips for one glance.
     *
     * {@code days} carries what each day adds up to, because the question the
     * grid answers is "what am I eating this week", not "what is in this box".
     */
    public record WeekView(
            LocalDate weekStart,
            int householdSize,
            List<PlannedMealView> meals,
            List<DayTotals> days,
            /** More than one account is looking at this plan. */
            boolean shared,
            boolean owner,
            int accounts) {
    }

    /**
     * One placed meal. {@code kcal} is for the planned servings, not per
     * serving: the day total is the sum of what the household actually eats.
     * Null when the recipe has no ingredients — a zero would read as "free".
     */
    public record PlannedMealView(
            Long id,
            LocalDate date,
            String slot,
            int position,
            Long recipeId,
            String title,
            int servings,
            /** What the recipe itself is written for, so the scaling is visible. */
            int recipeServings,
            int minutes,
            boolean hasPhoto,
            Double kcal,
            boolean estimated,
            /**
             * Who put it there, and only when that is somebody else. Null for
             * one's own doing: a shared plan should say what is new to the
             * reader, not repeat their own name twenty times.
             */
            String plannedBy) {
    }

    public record DayTotals(LocalDate date, int meals, Double kcal) {
    }

    public record AddMealRequest(
            @NotNull LocalDate date,
            @NotBlank String slot,
            @NotNull Long recipeId,
            /** Absent means "however many the household is" — the usual case. */
            @Min(1) @Max(24) Integer servings) {
    }

    /**
     * Moving and re-portioning are the same call: both are edits to a meal that
     * already exists, and a null field means "leave it alone". Moving must
     * never require re-entering the recipe.
     */
    public record UpdateMealRequest(
            LocalDate date,
            String slot,
            @Min(1) @Max(24) Integer servings) {
    }

    /**
     * {@code replace} is what the screen asks about before overwriting a week
     * somebody has already filled in.
     */
    public record CopyWeekRequest(
            @NotNull LocalDate from,
            @NotNull LocalDate to,
            boolean replace) {
    }

    public record HouseholdRequest(@Min(1) @Max(12) int size) {
    }

    public record HouseholdView(int size) {
    }

    /**
     * One ingredient line of one planned meal, scaled to the servings that meal
     * was planned for.
     *
     * This is the seam the shopping list is built on: it aggregates these by
     * name and unit. Exposed now so that changing a meal's servings provably
     * changes the quantities, before the list itself exists.
     */
    public record PlannedIngredientView(
            Long mealId,
            LocalDate date,
            String slot,
            Long recipeId,
            String recipeTitle,
            String name,
            double quantity,
            String unit) {
    }
}
