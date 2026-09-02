package ch.celestin.fuelr.log;

import ch.celestin.fuelr.nutrition.NutritionDtos;
import ch.celestin.fuelr.plan.CookedMealListener;
import org.springframework.stereotype.Component;

/**
 * Saying a planned meal was cooked writes it into the diary.
 *
 * The figures are computed from the ingredients as they are at that moment and
 * copied into the entry, which is the rule the whole log turns on. It is the
 * person who marked it cooked who ate it — a household shares a plan, not a
 * body.
 */
@Component
public class LogsCookedMeals implements CookedMealListener {

    private final LogService log;

    public LogsCookedMeals(LogService log) {
        this.log = log;
    }

    @Override
    public void mealCooked(CookedMeal meal) {
        log.logCooked(
                meal.userId(), meal.plannedMealId(), meal.recipeId(), meal.title(),
                meal.date(), meal.slot(),
                // One serving, not the whole pot. A meal planned for four is
                // four people's dinner; the person who marked it cooked ate
                // their share of it, and can say otherwise afterwards.
                1,
                meal.ingredients().stream()
                        .map(line -> new NutritionDtos.IngredientInput(
                                line.name(), line.quantity(), line.unit()))
                        .toList(),
                // The ingredients arrive already scaled to the planned
                // servings, so dividing by them gives one person's share.
                meal.servings());
    }
}
