package ch.celestin.fuelr.plan;

import ch.celestin.fuelr.account.User;
import ch.celestin.fuelr.account.UserRepository;
import ch.celestin.fuelr.nutrition.NutritionDtos;
import ch.celestin.fuelr.nutrition.NutritionService;
import ch.celestin.fuelr.plan.PlanDtos.AddMealRequest;
import ch.celestin.fuelr.plan.PlanDtos.CopyWeekRequest;
import ch.celestin.fuelr.plan.PlanDtos.DayTotals;
import ch.celestin.fuelr.plan.PlanDtos.PlannedIngredientView;
import ch.celestin.fuelr.plan.PlanDtos.PlannedMealView;
import ch.celestin.fuelr.plan.PlanDtos.UpdateMealRequest;
import ch.celestin.fuelr.plan.PlanDtos.WeekView;
import ch.celestin.fuelr.recipe.Recipe;
import ch.celestin.fuelr.recipe.RecipeRepository;
import ch.celestin.fuelr.recipe.RecipeService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * The week plan, always read and written through the household in front of the
 * caller. No method here takes a user id to scope a query with — the household
 * is the scope, which is what makes "visible to every member" true by
 * construction rather than by everyone remembering to widen a filter.
 */
@Service
public class PlanService {

    /** The target week already holds meals, and the caller did not say to replace them. */
    public static class WeekNotEmptyException extends RuntimeException {
        public WeekNotEmptyException() {
            super("week_not_empty");
        }
    }

    /** A day is planned against a recipe that is not the caller's, or gone. */
    public static class UnknownRecipeException extends RuntimeException {
        public UnknownRecipeException() {
            super("unknown_recipe");
        }
    }

    static final int DAYS_IN_WEEK = 7;

    private final PlannedMealRepository meals;
    private final HouseholdRepository households;
    private final HouseholdService householdService;
    private final HouseholdMemberRepository members;
    private final RecipeRepository recipes;
    private final UserRepository users;
    private final NutritionService nutrition;

    public PlanService(PlannedMealRepository meals, HouseholdRepository households,
                       HouseholdService householdService, HouseholdMemberRepository members,
                       RecipeRepository recipes, UserRepository users,
                       NutritionService nutrition) {
        this.meals = meals;
        this.households = households;
        this.householdService = householdService;
        this.members = members;
        this.recipes = recipes;
        this.users = users;
        this.nutrition = nutrition;
    }

    /**
     * Any day inside a week names that week. The client sends whatever it is
     * showing and gets the Monday back, so the two never disagree about where
     * the week starts.
     */
    public static LocalDate weekStart(LocalDate anyDay) {
        return anyDay.with(DayOfWeek.MONDAY);
    }

    // --- reading ------------------------------------------------------------

    public WeekView week(Long userId, LocalDate anyDay) {
        Household household = householdService.activeHouseholdFor(userId);
        LocalDate start = weekStart(anyDay);
        LocalDate end = start.plusDays(DAYS_IN_WEEK - 1L);

        List<PlannedMeal> planned = meals
                .findByHouseholdIdAndDateBetweenOrderByDateAscSlotAscPositionAsc(
                        household.getId(), start, end);
        Map<Long, Recipe> recipesById = recipesFor(planned);
        Map<Long, String> names = authorNames(planned);

        List<PlannedMealView> views = planned.stream()
                .map(meal -> toView(meal, recipesById.get(meal.getRecipeId()),
                        names.get(meal.getCreatedBy()), userId))
                .filter(java.util.Objects::nonNull)
                .toList();

        // Every day of the week is present, empty ones included. A day missing
        // from the response would make an empty Wednesday look like a failure
        // rather than a Wednesday with nothing planned.
        List<DayTotals> days = new ArrayList<>();
        for (int i = 0; i < DAYS_IN_WEEK; i++) {
            LocalDate day = start.plusDays(i);
            List<PlannedMealView> onDay = views.stream()
                    .filter(v -> v.date().equals(day)).toList();
            // Null rather than 0 when nothing on the day carries figures: the
            // grid says "—", which is honest, instead of "0 kcal", which is not.
            Double kcal = onDay.stream().map(PlannedMealView::kcal)
                    .filter(java.util.Objects::nonNull)
                    .reduce(Double::sum)
                    .map(PlanService::round)
                    .orElse(null);
            days.add(new DayTotals(day, onDay.size(), kcal));
        }

        long accounts = members.countByHouseholdId(household.getId()) + 1;
        return new WeekView(
                start, household.getSize(), views, days,
                accounts > 1,
                householdService.isOwner(household, userId),
                (int) accounts);
    }

    /**
     * Every ingredient line of the week, scaled to the servings each meal was
     * planned for. The shopping list aggregates this; nothing else does.
     */
    public List<PlannedIngredientView> ingredients(Long userId, LocalDate anyDay) {
        Household household = householdService.activeHouseholdFor(userId);
        LocalDate start = weekStart(anyDay);
        List<PlannedMeal> planned = meals
                .findByHouseholdIdAndDateBetweenOrderByDateAscSlotAscPositionAsc(
                        household.getId(), start, start.plusDays(DAYS_IN_WEEK - 1L));
        Map<Long, Recipe> recipesById = recipesFor(planned);

        List<PlannedIngredientView> lines = new ArrayList<>();
        for (PlannedMeal meal : planned) {
            Recipe recipe = recipesById.get(meal.getRecipeId());
            if (recipe == null) continue;
            double factor = scale(meal, recipe);
            recipe.getIngredients().forEach(ingredient -> lines.add(new PlannedIngredientView(
                    meal.getId(), meal.getDate(), meal.getSlot().name(),
                    recipe.getId(), recipe.getTitle(),
                    ingredient.getName(),
                    round(ingredient.getQuantity().doubleValue() * factor),
                    ingredient.getUnit())));
        }
        return lines;
    }

    // --- writing ------------------------------------------------------------

    @Transactional
    public PlannedMeal add(Long userId, AddMealRequest request) {
        // Planning is scoped to the household; what may be planned is still
        // scoped to the person. Nobody puts someone else's recipe on the week.
        Recipe recipe = recipes.findByIdAndUserId(request.recipeId(), userId)
                .orElseThrow(UnknownRecipeException::new);
        Household household = householdService.activeHouseholdFor(userId);
        MealSlot slot = MealSlot.parse(request.slot());
        // Portions default to the household, not to what the recipe happens to
        // be written for: the cook is feeding the same people every evening.
        int servings = request.servings() != null ? request.servings() : household.getSize();
        int position = meals
                .findByHouseholdIdAndDateAndSlotOrderByPositionAsc(
                        household.getId(), request.date(), slot)
                .size();
        return meals.save(new PlannedMeal(
                household.getId(), userId, recipe.getId(), request.date(), slot,
                position, servings));
    }

    /**
     * Moves a meal, re-portions it, or both. A null field is left alone, so the
     * screen can drag a card without also restating its servings.
     */
    @Transactional
    public PlannedMeal update(PlannedMeal meal, UpdateMealRequest request) {
        boolean moved = false;
        if (request.date() != null && !request.date().equals(meal.getDate())) {
            meal.setDate(request.date());
            moved = true;
        }
        if (request.slot() != null) {
            MealSlot slot = MealSlot.parse(request.slot());
            if (slot != meal.getSlot()) {
                meal.setSlot(slot);
                moved = true;
            }
        }
        if (request.servings() != null) {
            meal.setServings(request.servings());
        }
        if (moved) {
            // Landing in a new slot means landing at its end, never on top of
            // what is already there.
            meal.setPosition(meals
                    .findByHouseholdIdAndDateAndSlotOrderByPositionAsc(
                            meal.getHouseholdId(), meal.getDate(), meal.getSlot())
                    .stream().filter(m -> !m.getId().equals(meal.getId()))
                    .toList().size());
        }
        return meals.save(meal);
    }

    @Transactional
    public void remove(PlannedMeal meal) {
        meals.delete(meal);
        compact(meal.getHouseholdId(), meal.getDate(), meal.getSlot(), meal.getId());
    }

    /** A meal is the caller's to touch when it is on the plan they are looking at. */
    public java.util.Optional<PlannedMeal> find(Long id, Long userId) {
        return meals.findByIdAndHouseholdId(
                id, householdService.activeHouseholdFor(userId).getId());
    }

    /**
     * Copies a week onto another, weekday for weekday and slot for slot.
     *
     * The servings come along: last week's Sunday roast was for six, and it is
     * still for six. Refuses to write over a week that already holds meals
     * unless the caller says so — losing a planned week to a stray click is
     * exactly the kind of thing that makes people stop planning.
     */
    @Transactional
    public WeekView copyWeek(Long userId, CopyWeekRequest request) {
        Household household = householdService.activeHouseholdFor(userId);
        LocalDate from = weekStart(request.from());
        LocalDate to = weekStart(request.to());
        if (from.equals(to)) {
            return week(userId, to);
        }

        List<PlannedMeal> target = meals
                .findByHouseholdIdAndDateBetweenOrderByDateAscSlotAscPositionAsc(
                        household.getId(), to, to.plusDays(DAYS_IN_WEEK - 1L));
        if (!target.isEmpty()) {
            if (!request.replace()) {
                throw new WeekNotEmptyException();
            }
            meals.deleteAll(target);
        }

        List<PlannedMeal> source = meals
                .findByHouseholdIdAndDateBetweenOrderByDateAscSlotAscPositionAsc(
                        household.getId(), from, from.plusDays(DAYS_IN_WEEK - 1L));
        long offset = java.time.temporal.ChronoUnit.DAYS.between(from, to);
        meals.saveAll(source.stream()
                .map(meal -> new PlannedMeal(
                        household.getId(), userId, meal.getRecipeId(),
                        meal.getDate().plusDays(offset), meal.getSlot(),
                        meal.getPosition(), meal.getServings()))
                .toList());

        return week(userId, to);
    }

    // --- household ----------------------------------------------------------

    public int householdSize(Long userId) {
        return householdService.activeHouseholdFor(userId).getSize();
    }

    /**
     * Only the default for meals planned from now on. Meals already on the
     * grid keep their servings — the shopping list for a dinner that was
     * planned for eight must not silently drop to four.
     */
    @Transactional
    public int setHouseholdSize(Long userId, int size) {
        Household household = householdService.activeHouseholdFor(userId);
        household.setSize(size);
        return households.save(household).getSize();
    }

    // --- internals ----------------------------------------------------------

    /**
     * The recipes behind the meals, by id.
     *
     * Not filtered by owner: on a shared plan the dishes belong to whoever put
     * them there. The authorisation happened when the meal was created, and it
     * is the household row that carries it from then on.
     */
    private Map<Long, Recipe> recipesFor(List<PlannedMeal> planned) {
        List<Long> ids = planned.stream().map(PlannedMeal::getRecipeId).distinct().toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        return recipes.findAllById(ids).stream()
                .collect(Collectors.toMap(Recipe::getId, Function.identity(),
                        (a, b) -> a, LinkedHashMap::new));
    }

    private Map<Long, String> authorNames(List<PlannedMeal> planned) {
        List<Long> ids = planned.stream()
                .map(PlannedMeal::getCreatedBy)
                .filter(java.util.Objects::nonNull)
                .distinct().toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        return users.findAllById(ids).stream()
                .collect(Collectors.toMap(
                        User::getId,
                        user -> user.getName() == null ? user.getEmail() : user.getName(),
                        (a, b) -> a, LinkedHashMap::new));
    }

    /** How much of the recipe this meal is: six people out of a recipe for four. */
    private static double scale(PlannedMeal meal, Recipe recipe) {
        int base = Math.max(1, recipe.getServings());
        return (double) meal.getServings() / base;
    }

    private PlannedMealView toView(PlannedMeal meal, Recipe recipe, String author, Long viewer) {
        // The recipe is gone from under the meal — cascade should have taken
        // the row with it, so this is a torn read rather than a normal state.
        if (recipe == null) {
            return null;
        }
        NutritionDtos.Breakdown breakdown = recipe.getIngredients().isEmpty() ? null
                : nutrition.compute(
                        recipe.getIngredients().stream()
                                .map(i -> new NutritionDtos.IngredientInput(
                                        i.getName(), i.getQuantity().doubleValue(), i.getUnit()))
                                .toList(),
                        Math.max(1, recipe.getServings()));

        return new PlannedMealView(
                meal.getId(), meal.getDate(), meal.getSlot().name(), meal.getPosition(),
                recipe.getId(), recipe.getTitle(), meal.getServings(), recipe.getServings(),
                RecipeService.minutesFor(recipe), recipe.getPhotoPath() != null,
                breakdown == null ? null
                        : round(breakdown.perServing().kcal() * meal.getServings()),
                breakdown != null && breakdown.containsEstimates(),
                // The name is only worth showing for somebody else's doing.
                meal.getCreatedBy() != null && meal.getCreatedBy().equals(viewer) ? null : author);
    }

    private void compact(Long householdId, LocalDate date, MealSlot slot, Long removedId) {
        List<PlannedMeal> remaining = meals
                .findByHouseholdIdAndDateAndSlotOrderByPositionAsc(householdId, date, slot).stream()
                .filter(m -> !m.getId().equals(removedId))
                .toList();
        for (int i = 0; i < remaining.size(); i++) {
            remaining.get(i).setPosition(i);
        }
        meals.saveAll(remaining);
    }

    private static double round(double value) {
        return Math.round(value * 10d) / 10d;
    }
}
