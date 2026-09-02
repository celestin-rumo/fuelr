package ch.celestin.fuelr.shopping;

import ch.celestin.fuelr.plan.CookedMealListener;
import org.springframework.stereotype.Component;

/** Cooking a meal is what takes its ingredients off the shelf. */
@Component
public class PantryConsumesCookedMeals implements CookedMealListener {

    private final PantryService pantry;

    public PantryConsumesCookedMeals(PantryService pantry) {
        this.pantry = pantry;
    }

    @Override
    public void mealCooked(CookedMeal meal) {
        pantry.consume(meal.householdId(), meal.ingredients());
    }
}
