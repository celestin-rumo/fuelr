package ch.celestin.fuelr.nutrition;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;

/**
 * Turns a list of ingredients into energy and macros.
 *
 * This lives on the server on purpose: the web app and the future React Native
 * app must produce the same numbers from the same reference table. A client
 * that computed its own would drift the moment either shipped.
 */
@Service
public class NutritionService {

    /** Used when no reference food matches; the result is flagged as guessed. */
    static final double[] FALLBACK = { 60, 2, 8, 2 };

    private final FoodNutritionRepository foods;

    public NutritionService(FoodNutritionRepository foods) {
        this.foods = foods;
    }

    /**
     * Grams and millilitres are read against the per-100 reference. The other
     * units are conversions to that same scale: one piece counts as 120 g, a
     * tablespoon as 15 g, a teaspoon as 5 g.
     */
    static double factorFor(String unit, double quantity) {
        return switch (unit) {
            case "g", "ml" -> quantity / 100d;
            case "pcs" -> quantity * 1.2d;
            case "c.à.s" -> quantity * 0.15d;
            case "c.à.c" -> quantity * 0.05d;
            default -> throw new IllegalArgumentException("Unité inconnue : " + unit);
        };
    }

    public NutritionDtos.Breakdown compute(List<NutritionDtos.IngredientInput> ingredients, int servings) {
        if (servings < 1) {
            throw new IllegalArgumentException("Le nombre de portions doit être au moins 1.");
        }
        List<FoodNutrition> reference = foods.findAll();

        double kcal = 0, protein = 0, carbs = 0, fat = 0;
        boolean anyGuessed = false;
        var lines = new java.util.ArrayList<NutritionDtos.IngredientBreakdown>();

        for (NutritionDtos.IngredientInput ingredient : ingredients) {
            FoodNutrition match = match(reference, ingredient.name());
            double factor = factorFor(ingredient.unit(), ingredient.quantity());

            double[] per100 = match != null
                    ? new double[] { match.getKcal(), match.getProteinG(), match.getCarbsG(), match.getFatG() }
                    : FALLBACK;

            double k = per100[0] * factor;
            double p = per100[1] * factor;
            double c = per100[2] * factor;
            double f = per100[3] * factor;

            kcal += k; protein += p; carbs += c; fat += f;
            anyGuessed |= match == null;

            lines.add(new NutritionDtos.IngredientBreakdown(
                    ingredient.name(), round(k), round(p), round(c), round(f), match == null));
        }

        var total = new NutritionDtos.Totals(round(kcal), round(protein), round(carbs), round(fat));
        var perServing = new NutritionDtos.Totals(
                round(kcal / servings), round(protein / servings),
                round(carbs / servings), round(fat / servings));

        return new NutritionDtos.Breakdown(total, perServing, servings, anyGuessed, lines);
    }

    /**
     * Which aisle an ingredient name is found in, or null when the reference
     * table has never heard of it.
     *
     * The shopping list groups by this. It goes through the same matcher as
     * the figures do on purpose: a name that is recognised for its calories
     * and not for its aisle would be a second, quieter way of being wrong.
     */
    public String aisleOf(String name) {
        FoodNutrition match = match(foods.findAll(), name);
        return match == null ? null : match.getAisle();
    }

    /**
     * Substring match on a lowercased name, mirroring how people type, with
     * the longest matching key winning.
     *
     * "Lentilles corail" contains both "lentilles" and "ail", and taking the
     * first match made the answer depend on the order rows came back in — which
     * is unspecified, and which an unrelated {@code UPDATE} on the table
     * silently changed. Longest wins is both deterministic and right: the more
     * specific key is the better guess. The key breaks ties so that two keys of
     * equal length cannot reintroduce the same coin toss.
     */
    private static FoodNutrition match(List<FoodNutrition> reference, String name) {
        String needle = name.toLowerCase(Locale.ROOT);
        return reference.stream()
                .filter(food -> needle.contains(food.getMatchKey()))
                .max(java.util.Comparator
                        .comparingInt((FoodNutrition food) -> food.getMatchKey().length())
                        .thenComparing(FoodNutrition::getMatchKey))
                .orElse(null);
    }

    private static double round(double value) {
        return Math.round(value * 10d) / 10d;
    }
}
