package ch.celestin.fuelr.plan;

import java.time.LocalDate;
import java.util.List;

/**
 * What happens elsewhere when a planned meal is cooked.
 *
 * The plan package owns the event and knows nothing about who acts on it — the
 * cupboard empties, the log records what was eaten, and tomorrow something
 * else will listen. Having planning call into any of them would put the
 * packages in a circle, which is the same reason {@code RecipeAudience} is
 * shaped this way.
 */
public interface CookedMealListener {

    void mealCooked(CookedMeal meal);

    /**
     * Everything a listener could need, so that adding one never means going
     * back and widening the event for everybody.
     */
    record CookedMeal(
            Long householdId,
            /** Who said they cooked it. The log is personal; the cupboard is not. */
            Long userId,
            Long plannedMealId,
            Long recipeId,
            String title,
            LocalDate date,
            String slot,
            int servings,
            List<PlanDtos.PlannedIngredientView> ingredients) {
    }
}
