package ch.celestin.fuelr.plan;

import ch.celestin.fuelr.recipe.Recipe;
import ch.celestin.fuelr.recipe.RecipeIngredient;
import ch.celestin.fuelr.recipe.RecipeService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * A week already on the plan, read as one afternoon's work.
 *
 * The other half of "preparation", and the opposite end from
 * `BatchSuggestionService`: that one *chooses* a week so the work can be
 * shared, this one takes a week somebody already filled and says how to get
 * through it in one session.
 *
 * The work is grouped by shared base rather than by recipe, because that is
 * what makes a Sunday afternoon shorter than six evenings: the carrots are
 * peeled once, the rice is cooked once, and each dish is then finished from
 * something already made. What counts as a base is `SharedBase` and nothing
 * else — an onion in four dishes is not a base, and a plan built on that kind
 * of arithmetic looks rigorous and wastes an afternoon.
 *
 * **Two things this deliberately does not do.** It never says how long anything
 * keeps: no published figure sits behind it, and a made-up shelf life is a
 * health risk rather than an approximation — the screen says it does not know
 * and leaves the decision where it belongs. And it is not cooking mode: that
 * one follows one recipe, one step at a time, with dirty hands. This is a sheet
 * read before starting.
 */
@Service
public class PrepService {

    /** One ingredient several dishes are built on, and how much of it. */
    public record Base(
            String name,
            String unit,
            /** Summed across the dishes, at the servings each was planned for. */
            double quantity,
            /** Which dishes it serves, so the total can be checked. */
            List<String> dishes) {
    }

    /** One dish's own work, once the bases are made. */
    public record Dish(
            Long mealId,
            LocalDate date,
            String slot,
            String title,
            int minutes,
            int servings,
            List<String> steps,
            /** What is left after the shared bases, so nothing is done twice. */
            List<Line> rest) {
    }

    public record Line(String name, double quantity, String unit) {
    }

    public record Session(
            LocalDate weekStart,
            List<Base> bases,
            /** Longest first: what takes the longest starts, what cools waits. */
            List<Dish> dishes) {
    }

    private final PlanService plan;
    private final RecipeService recipes;

    public PrepService(PlanService plan, RecipeService recipes) {
        this.plan = plan;
        this.recipes = recipes;
    }

    /**
     * The session for a week.
     *
     * Reads the plan as it stands and writes nothing. A meal taken out of the
     * shopping list is still in here: that flag says the ingredients are
     * already in the cupboard, not that the dish cooks itself.
     */
    // Not `readOnly`: a household is created the first time anything needs
    // one, so the very first read of this screen writes a row. Marking it
    // read-only fails on a brand-new account and on nothing else, which is the
    // one case nobody runs by hand.
    @Transactional
    public Session forWeek(Long userId, LocalDate anyDay) {
        PlanDtos.WeekView week = plan.week(userId, anyDay);

        // Ingredient lines are already scaled to what each meal was planned
        // for, which is what makes the summed quantity below usable rather
        // than indicative.
        Map<Long, List<PlanDtos.PlannedIngredientView>> byMeal = new LinkedHashMap<>();
        for (PlanDtos.PlannedIngredientView line : plan.ingredients(userId, anyDay)) {
            byMeal.computeIfAbsent(line.mealId(), ignored -> new ArrayList<>()).add(line);
        }

        // A meal excluded from the shopping list reports no lines there, so its
        // ingredients are fetched from the recipe instead: it is still cooked.
        for (PlanDtos.PlannedMealView meal : week.meals()) {
            byMeal.computeIfAbsent(meal.id(), ignored -> scaled(userId, meal));
        }

        Map<String, Base> bases = new LinkedHashMap<>();

        for (PlanDtos.PlannedMealView meal : week.meals()) {
            String title = meal.title() == null ? "" : meal.title();
            Set<String> mine = new LinkedHashSet<>();
            for (PlanDtos.PlannedIngredientView line : byMeal.getOrDefault(meal.id(), List.of())) {
                if (!SharedBase.carriesWork(line.unit(), line.quantity())) {
                    continue;
                }
                String key = SharedBase.keyOf(line.name(), line.unit());
                // Once per dish: a recipe listing carrots twice still peels
                // them once, and counting it twice inflates the whole sheet.
                if (!mine.add(key)) {
                    continue;
                }
                bases.merge(key,
                        new Base(line.name().trim(), line.unit(), line.quantity(),
                                List.of(title)),
                        (current, more) -> new Base(current.name(), current.unit(),
                                current.quantity() + more.quantity(),
                                concat(current.dishes(), more.dishes())));
            }
        }

        List<Base> shared = bases.entrySet().stream()
                .filter(entry -> entry.getValue().dishes().size() >= 2)
                .sorted(Comparator
                        .comparingInt((Map.Entry<String, Base> entry) ->
                                entry.getValue().dishes().size())
                        .reversed()
                        .thenComparing(entry -> entry.getValue().name()))
                .map(Map.Entry::getValue)
                .toList();
        Set<String> sharedKeys = bases.entrySet().stream()
                .filter(entry -> entry.getValue().dishes().size() >= 2)
                .map(Map.Entry::getKey)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));

        List<Dish> dishes = week.meals().stream()
                .map(meal -> dish(userId, meal, byMeal.getOrDefault(meal.id(), List.of()),
                        sharedKeys))
                // What takes the longest starts. Ties keep the week's own order,
                // so two 40-minute dishes read in the order they are eaten.
                .sorted(Comparator.comparingInt(Dish::minutes).reversed())
                .toList();

        return new Session(week.weekStart(), shared, dishes);
    }

    private Dish dish(Long userId, PlanDtos.PlannedMealView meal,
                      List<PlanDtos.PlannedIngredientView> lines, Set<String> sharedKeys) {
        List<Line> rest = lines.stream()
                .filter(line -> !sharedKeys.contains(
                        SharedBase.keyOf(line.name(), line.unit())))
                .map(line -> new Line(line.name(), line.quantity(), line.unit()))
                .toList();

        List<String> steps = recipes.find(meal.recipeId(), userId)
                .map(recipe -> recipe.getSteps().stream()
                        .map(ch.celestin.fuelr.recipe.RecipeStep::getText).toList())
                .orElse(List.of());

        return new Dish(meal.id(), meal.date(), meal.slot(), meal.title(),
                meal.minutes(), meal.servings(), steps, rest);
    }

    /**
     * A meal's lines when the plan is not reporting them.
     *
     * Only reached for a meal somebody has taken out of the shopping list.
     * Having the ingredients already does not remove the work of using them.
     */
    private List<PlanDtos.PlannedIngredientView> scaled(Long userId,
                                                        PlanDtos.PlannedMealView meal) {
        return recipes.find(meal.recipeId(), userId)
                .map(recipe -> {
                    double factor = recipe.getServings() <= 0
                            ? 1 : (double) meal.servings() / recipe.getServings();
                    List<PlanDtos.PlannedIngredientView> lines = new ArrayList<>();
                    for (RecipeIngredient line : recipe.getIngredients()) {
                        if (line.getQuantity() == null) {
                            continue;
                        }
                        double quantity = Math.round(
                                line.getQuantity().doubleValue() * factor * 100) / 100d;
                        lines.add(new PlanDtos.PlannedIngredientView(
                                meal.id(), meal.date(), meal.slot(), recipe.getId(),
                                recipe.getTitle(), line.getName(), quantity, line.getUnit()));
                    }
                    return lines;
                })
                .orElse(List.of());
    }

    private static List<String> concat(List<String> one, List<String> other) {
        List<String> both = new ArrayList<>(one);
        both.addAll(other);
        return both;
    }
}
