package ch.celestin.fuelr.recipe.illustration;

import ch.celestin.fuelr.ai.AiBudget;
import ch.celestin.fuelr.media.MediaStorage;
import ch.celestin.fuelr.recipe.Recipe;
import ch.celestin.fuelr.recipe.RecipeIngredient;
import ch.celestin.fuelr.recipe.RecipeRepository;
import ch.celestin.fuelr.subscription.Entitlements;
import ch.celestin.fuelr.subscription.Feature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * A picture for every dish a model wrote, drawn after the fact.
 *
 * Runs after `POST /api/recipes/from-idea` has answered, on its own pool:
 * the answer is the recipe, and the picture is a few seconds behind it. Until
 * it lands the row shows the tile drawn from the title, so nothing waits and
 * nothing is missing. It is paid per picture, so it goes through the same
 * gates as every other call — the plan, the month's budget — and it is
 * recorded in `ai_usage` the moment the provider has answered, whether or
 * not the bytes then turn out to be usable: the money is spent either way.
 *
 * What the picture is made *from* is the title and the ingredient names,
 * and nothing else about the person. That is what leaves for the provider,
 * and the privacy page says so.
 */
@Service
public class IllustrationService {

    private static final Logger log = LoggerFactory.getLogger(IllustrationService.class);

    /** The first few lines say what the dish is; the salt does not help. */
    private static final int INGREDIENTS_IN_PROMPT = 6;

    private final RecipeRepository recipes;
    private final MediaStorage media;
    private final List<RecipeIllustrator> illustrators;
    private final AiBudget budget;
    private final Entitlements entitlements;
    private final long priceMicros;

    public IllustrationService(RecipeRepository recipes, MediaStorage media,
                               List<RecipeIllustrator> illustrators, AiBudget budget,
                               Entitlements entitlements,
                               @Value("${app.ai.illustration.price-micros:3000}") long priceMicros) {
        this.recipes = recipes;
        this.media = media;
        this.illustrators = illustrators;
        this.budget = budget;
        this.entitlements = entitlements;
        this.priceMicros = priceMicros;
    }

    /** The illustrator in use, which is the one that draws nothing when none is wired. */
    public RecipeIllustrator illustrator() {
        return illustrators.stream()
                .filter(RecipeIllustrator::available)
                .findFirst()
                .orElse(illustrators.get(illustrators.size() - 1));
    }

    @Async("illustrationExecutor")
    @Transactional
    public void illustrate(Long userId, Long recipeId) {
        RecipeIllustrator illustrator = illustrator();
        if (!illustrator.available() || !entitlements.has(userId, Feature.AI_MENU)) {
            return;
        }
        try {
            budget.require(userId);
        } catch (AiBudget.ExhaustedException e) {
            return;
        }
        Recipe recipe = recipes.findById(recipeId).orElse(null);
        if (recipe == null || recipe.getPhotoPath() != null) {
            return;
        }
        try {
            byte[] bytes = illustrator.illustrate(promptFor(recipe)).orElse(null);
            if (bytes == null) {
                return;
            }
            budget.record(userId, "ILLUSTRATION", illustrator.name(), priceMicros);
            // Believed exactly as far as an upload is: sniffed and capped.
            String stored = media.store(bytes);
            recipe.setPhotoPath(stored);
            recipe.setPhotoOrigin(Recipe.PhotoOrigin.GENERATED);
            recipes.save(recipe);
        } catch (RuntimeException e) {
            // A dish without a picture is a dish without a picture, not a failure.
            log.warn("No illustration for recipe {}: {}", recipeId, e.toString());
        }
    }

    /**
     * English, because that is what the model was trained on; the dish's
     * name stays as written. Overhead, daylight, no text: a picture that
     * reads as a plate at 44 pixels, and never as a poster.
     */
    static String promptFor(Recipe recipe) {
        StringBuilder prompt = new StringBuilder("Food photograph of ")
                .append(recipe.getTitle() == null ? "a dish" : recipe.getTitle().trim());
        List<String> names = recipe.getIngredients().stream()
                .map(RecipeIngredient::getName)
                .filter(name -> name != null && !name.isBlank())
                .limit(INGREDIENTS_IN_PROMPT)
                .toList();
        if (!names.isEmpty()) {
            prompt.append(", made with ").append(String.join(", ", names));
        }
        prompt.append(". Plated and ready to eat, overhead view, soft natural daylight,")
                .append(" rustic wooden table, shallow depth of field, no text, no people.");
        return prompt.toString();
    }
}
