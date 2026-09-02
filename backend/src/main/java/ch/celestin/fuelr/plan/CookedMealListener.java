package ch.celestin.fuelr.plan;

import java.util.List;

/**
 * What happens elsewhere when a planned meal is cooked.
 *
 * The plan package owns the event and knows nothing about who acts on it — the
 * cupboard does today, the meal log will tomorrow. Having planning call into
 * either of them would put the packages in a circle, which is the same reason
 * {@code RecipeAudience} is shaped this way.
 */
public interface CookedMealListener {

    void mealCooked(Long householdId, List<PlanDtos.PlannedIngredientView> ingredients);
}
