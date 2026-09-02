package ch.celestin.fuelr.recipe.importer;

import java.time.Duration;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The reading of individual fields, shared by every parser: the formats differ
 * in where a value sits, not in what "4 personnes" or "PT20M" means.
 */
final class RecipeFields {

    /** A count only when it names people or parts — "env. 600 g" is neither. */
    private static final Pattern SERVINGS = Pattern.compile(
            "(\\d+)\\s*(personnes?|parts?|portions?|servings?|pers\\.?|Personen|Portionen)",
            Pattern.CASE_INSENSITIVE);

    private RecipeFields() {
    }

    static void readServings(ParsedRecipe recipe, String yield) {
        if (yield == null || yield.isBlank()) {
            recipe.flag("servings");
            return;
        }
        Matcher matcher = SERVINGS.matcher(yield);
        if (matcher.find()) {
            int count = Integer.parseInt(matcher.group(1));
            if (count >= 1 && count <= 12) {
                recipe.setServings(count);
                return;
            }
        }
        // A yield that is not a number of servings — "env. 600 g de pâte".
        // Better to ask than to read 600 as six hundred people.
        recipe.flag("servings");
    }

    static Integer firstDuration(String... candidates) {
        for (String candidate : candidates) {
            if (candidate == null || candidate.isBlank()) {
                continue;
            }
            try {
                long minutes = Duration.parse(candidate).toMinutes();
                if (minutes > 0) {
                    return (int) minutes;
                }
            } catch (DateTimeParseException ignored) {
                // Not an ISO-8601 duration; try the next candidate.
            }
        }
        return null;
    }

    static void addIngredient(ParsedRecipe recipe, String line) {
        if (line == null || line.isBlank()) {
            return;
        }
        var parsed = IngredientLineParser.parse(line);
        if (parsed != null) {
            recipe.getIngredients().add(parsed);
        }
    }

    static void addStep(ParsedRecipe recipe, String text) {
        if (text != null && !text.isBlank()) {
            recipe.getSteps().add(text.trim());
        }
    }

    /**
     * One block of prose is not one step. Splitting on sentence ends is a
     * guess, so a recipe built this way is flagged: the cook reorders steps
     * far more cheaply than they reconstruct them.
     */
    static void addProse(ParsedRecipe recipe, String prose) {
        if (prose == null || prose.isBlank()) {
            return;
        }
        String cleaned = prose.replaceAll("\\s+", " ").trim();
        List<String> sentences = List.of(cleaned.split("(?<=[.!?])\\s+(?=[A-ZÀ-ÖØ-Þ])"));
        sentences.forEach(sentence -> addStep(recipe, sentence));
        if (sentences.size() > 1) {
            recipe.flag("steps");
        }
    }
}
