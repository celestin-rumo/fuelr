package ch.celestin.fuelr.nutrition;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Turns a list of ingredients into energy and macros.
 *
 * This lives on the server on purpose: the web app and the future React Native
 * app must produce the same numbers from the same reference table. A client
 * that computed its own would drift the moment either shipped.
 *
 * Which food an ingredient names is {@link FoodMatcher}'s question, and a
 * deliberately hard one — see the note there about why the answer is not
 * simply the first row whose name appears in the text.
 */
@Service
public class NutritionService {

    private static final Logger log = LoggerFactory.getLogger(NutritionService.class);

    /**
     * Used when no reference food matches; the result is flagged as guessed.
     *
     * It stays even now the table has twelve hundred foods. No published table
     * covers a brand, a grandmother's preparation or a regional name, and a
     * plausible number that says it is a guess is more useful than a blank —
     * as long as it says so, which is what {@code guessed} is for.
     */
    static final double[] FALLBACK = { 60, 2, 8, 2 };

    private final FoodMatcher matcher;
    private final FoodMicronutrientRepository micronutrients;

    public NutritionService(FoodMatcher matcher, FoodMicronutrientRepository micronutrients) {
        this.matcher = matcher;
        this.micronutrients = micronutrients;
    }

    /**
     * Grams and millilitres are read against the per-100 reference. The other
     * units are conversions to that same scale: one piece counts as 120 g, a
     * tablespoon as 15 g, a teaspoon as 5 g.
     *
     * No unit at all counts as nothing, and that is not a hole. Every import
     * in this app produces such lines on purpose — "sel, poivre", "une poignée
     * de coriandre" — as a line it could not split, marked for review and left
     * whole. They are a pinch of something either way; refusing to compute a
     * recipe because one of them is in it would deny figures to most imported
     * recipes, which is a worse answer than figures that ignore a pinch. The
     * breakdown says the recipe contains estimates regardless.
     */
    static double factorFor(String unit, double quantity) {
        return switch (unit == null ? "" : unit.trim()) {
            case "" -> 0d;
            case "g", "ml" -> quantity / 100d;
            case "pcs" -> quantity * 1.2d;
            case "c.à.s" -> quantity * 0.15d;
            case "c.à.c" -> quantity * 0.05d;
            default -> throw new IllegalArgumentException("Unité inconnue : " + unit);
        };
    }

    /**
     * The same figures, for a screen that is showing a recipe rather than
     * editing one.
     *
     * An ingredient measured in a unit this app does not know cannot be
     * turned into a number, and {@link #compute} says so with an exception —
     * which is right in an editor, where somebody typed it and can fix it. It
     * is wrong everywhere else: a library, a week's plan or a shopping list
     * that refuses to render because one line of one recipe is unreadable is
     * the whole screen taken down by one row. That happened: an import wrote
     * `piece` instead of `pcs` and the library reported itself empty, for
     * good, with every recipe still in the database.
     *
     * So a display asks for the figures and accepts not getting them. No
     * figures is a state the screens already know how to show — it is what a
     * recipe with no ingredients looks like.
     */
    public Optional<NutritionDtos.Breakdown> computeForDisplay(
            List<NutritionDtos.IngredientInput> ingredients, int servings) {
        try {
            return Optional.of(compute(ingredients, servings));
        } catch (IllegalArgumentException e) {
            log.warn("No figures for a recipe: {}", e.getMessage());
            return Optional.empty();
        }
    }

    public NutritionDtos.Breakdown compute(List<NutritionDtos.IngredientInput> ingredients, int servings) {
        if (servings < 1) {
            throw new IllegalArgumentException("Le nombre de portions doit être au moins 1.");
        }

        double kcal = 0, protein = 0, carbs = 0, fat = 0;
        boolean anyGuessed = false;
        var lines = new ArrayList<NutritionDtos.IngredientBreakdown>();

        for (NutritionDtos.IngredientInput ingredient : ingredients) {
            Optional<Food> match = matcher.match(ingredient.name());
            double factor = factorFor(ingredient.unit(), ingredient.quantity());

            double[] per100 = match
                    .map(food -> new double[] {
                            food.getKcal(),
                            orZero(food.getProteinG()),
                            orZero(food.getCarbsG()),
                            orZero(food.getFatG()) })
                    .orElse(FALLBACK);

            double k = per100[0] * factor;
            double p = per100[1] * factor;
            double c = per100[2] * factor;
            double f = per100[3] * factor;

            kcal += k; protein += p; carbs += c; fat += f;
            anyGuessed |= match.isEmpty();

            lines.add(new NutritionDtos.IngredientBreakdown(
                    ingredient.name(), round(k), round(p), round(c), round(f), match.isEmpty()));
        }

        var total = new NutritionDtos.Totals(round(kcal), round(protein), round(carbs), round(fat));
        var perServing = new NutritionDtos.Totals(
                round(kcal / servings), round(protein / servings),
                round(carbs / servings), round(fat / servings));

        return new NutritionDtos.Breakdown(total, perServing, servings, anyGuessed, lines);
    }

    /**
     * Everything past the four headline figures: fibre, sugars, salt, and the
     * vitamins and minerals the source measured.
     *
     * Computed rather than stored, from the same match as the summary, so the
     * detail can never disagree with the card it was opened from.
     */
    public NutritionDtos.Detail detail(List<NutritionDtos.IngredientInput> ingredients, int servings) {
        if (servings < 1) {
            throw new IllegalArgumentException("Le nombre de portions doit être au moins 1.");
        }

        double kcal = 0, protein = 0, carbs = 0, fat = 0, fibre = 0, sugars = 0, salt = 0;
        boolean anyGuessed = false;
        Map<Long, Double> factors = new LinkedHashMap<>();
        var lines = new ArrayList<NutritionDtos.IngredientBreakdown>();

        for (NutritionDtos.IngredientInput ingredient : ingredients) {
            Optional<Food> match = matcher.match(ingredient.name());
            double factor = factorFor(ingredient.unit(), ingredient.quantity());
            anyGuessed |= match.isEmpty();

            if (match.isPresent()) {
                Food food = match.get();
                kcal += food.getKcal() * factor;
                protein += orZero(food.getProteinG()) * factor;
                carbs += orZero(food.getCarbsG()) * factor;
                fat += orZero(food.getFatG()) * factor;
                fibre += orZero(food.getFibreG()) * factor;
                sugars += orZero(food.getSugarsG()) * factor;
                salt += orZero(food.getSaltG()) * factor;
                factors.merge(food.getId(), factor, Double::sum);
                lines.add(new NutritionDtos.IngredientBreakdown(
                        ingredient.name(),
                        round(food.getKcal() * factor),
                        round(orZero(food.getProteinG()) * factor),
                        round(orZero(food.getCarbsG()) * factor),
                        round(orZero(food.getFatG()) * factor),
                        false));
            } else {
                kcal += FALLBACK[0] * factor;
                protein += FALLBACK[1] * factor;
                carbs += FALLBACK[2] * factor;
                fat += FALLBACK[3] * factor;
                lines.add(new NutritionDtos.IngredientBreakdown(
                        ingredient.name(),
                        round(FALLBACK[0] * factor), round(FALLBACK[1] * factor),
                        round(FALLBACK[2] * factor), round(FALLBACK[3] * factor), true));
            }
        }

        // A guessed ingredient contributes no micronutrients at all: the
        // fallback has none to give, and inventing them would be the one thing
        // this screen must not do.
        Map<String, double[]> summed = new LinkedHashMap<>();
        Map<String, String> units = new LinkedHashMap<>();
        if (!factors.isEmpty()) {
            for (FoodMicronutrient nutrient : micronutrients.findByFoodIdIn(factors.keySet())) {
                double factor = factors.getOrDefault(nutrient.getFoodId(), 0d);
                summed.computeIfAbsent(nutrient.getCode(), ignored -> new double[1])[0]
                        += nutrient.getAmount() * factor;
                units.putIfAbsent(nutrient.getCode(), nutrient.getUnit());
            }
        }

        List<NutritionDtos.NutrientAmount> perServingNutrients = summed.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> new NutritionDtos.NutrientAmount(
                        entry.getKey(),
                        round(entry.getValue()[0] / servings),
                        units.get(entry.getKey())))
                .toList();

        return new NutritionDtos.Detail(
                new NutritionDtos.DetailedTotals(
                        round(kcal), round(protein), round(carbs), round(fat),
                        round(fibre), round(sugars), round(salt)),
                new NutritionDtos.DetailedTotals(
                        round(kcal / servings), round(protein / servings),
                        round(carbs / servings), round(fat / servings),
                        round(fibre / servings), round(sugars / servings),
                        round(salt / servings)),
                servings, anyGuessed, perServingNutrients, lines);
    }

    /**
     * Which aisle an ingredient is found in, or null when nothing matched.
     *
     * The shopping list groups by this, and it goes through the same matcher
     * as the figures do: a name recognised for its calories and not for its
     * aisle would be a second, quieter way of being wrong.
     */
    public String aisleOf(String name) {
        return matcher.match(name).map(Food::getAisle).orElse(null);
    }

    private static double orZero(Double value) {
        return value == null ? 0d : value;
    }

    private static double round(double value) {
        return Math.round(value * 10d) / 10d;
    }
}
