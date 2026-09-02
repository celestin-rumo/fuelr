package ch.celestin.fuelr.plan;

import ch.celestin.fuelr.recipe.RecipeAudience;
import org.springframework.stereotype.Component;

/**
 * A recipe on the plan you are looking at is a recipe you may read.
 *
 * Narrow on purpose. Sharing a household does not open one person's library to
 * the others — it opens the dishes that were actually put on the shared week,
 * because a plan you cannot open the recipes of is a list of titles.
 */
@Component
public class PlannedRecipeAudience implements RecipeAudience {

    private final PlannedMealRepository meals;
    private final HouseholdService households;

    public PlannedRecipeAudience(PlannedMealRepository meals, HouseholdService households) {
        this.meals = meals;
        this.households = households;
    }

    @Override
    public boolean canRead(Long userId, Long recipeId) {
        return meals.existsByHouseholdIdAndRecipeId(
                households.activeHouseholdFor(userId).getId(), recipeId);
    }
}
