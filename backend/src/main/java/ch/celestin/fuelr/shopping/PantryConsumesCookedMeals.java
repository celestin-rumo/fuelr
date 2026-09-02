package ch.celestin.fuelr.shopping;

import ch.celestin.fuelr.plan.CookedMealListener;
import ch.celestin.fuelr.plan.PlanDtos.PlannedIngredientView;
import org.springframework.stereotype.Component;

import java.util.List;

/** Cooking a meal is what takes its ingredients off the shelf. */
@Component
public class PantryConsumesCookedMeals implements CookedMealListener {

    private final PantryService pantry;

    public PantryConsumesCookedMeals(PantryService pantry) {
        this.pantry = pantry;
    }

    @Override
    public void mealCooked(Long householdId, List<PlannedIngredientView> ingredients) {
        pantry.consume(householdId, ingredients);
    }
}
