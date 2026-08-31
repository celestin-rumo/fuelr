package ch.celestin.fuelr.recipe;

import ch.celestin.fuelr.recipe.RecipeDtos.IngredientInput;
import ch.celestin.fuelr.recipe.RecipeDtos.SaveRequest;
import ch.celestin.fuelr.recipe.RecipeDtos.ValidationError;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class RecipeService {

    private final RecipeRepository recipes;

    public RecipeService(RecipeRepository recipes) {
        this.recipes = recipes;
    }

    /**
     * Creates an empty draft. Called the moment the editor is opened, before
     * anything has been typed — the recipe has an id from the first click, so
     * every later keystroke is an update to something that already exists.
     */
    @Transactional
    public Recipe createDraft(Long userId) {
        return recipes.save(new Recipe(userId));
    }

    public List<Recipe> list(Long userId) {
        return recipes.findByUserIdOrderByFavoriteDescUpdatedAtDesc(userId);
    }

    public Optional<Recipe> find(Long id, Long userId) {
        return recipes.findByIdAndUserId(id, userId);
    }

    /**
     * Saves whatever the author has so far. Never rejects an incomplete
     * recipe: refusing to save a draft is how work gets lost.
     */
    @Transactional
    public Recipe save(Recipe recipe, SaveRequest body) {
        if (body.title() != null) recipe.setTitle(blankToNull(body.title()));
        if (body.description() != null) recipe.setDescription(blankToNull(body.description()));
        if (body.servings() != null) recipe.setServings(body.servings());
        if (body.level() != null) recipe.setLevel(blankToNull(body.level()));

        if (body.ingredients() != null) {
            recipe.getIngredients().clear();
            for (IngredientInput input : body.ingredients()) {
                recipe.getIngredients().add(new RecipeIngredient(
                        input.name().trim(),
                        BigDecimal.valueOf(input.quantity()),
                        input.unit()));
            }
        }
        if (body.steps() != null) {
            // A blank step is never persisted. The editor keeps one around
            // while the author is still typing into it, but it has no place
            // in a stored recipe — so it is dropped here rather than
            // rejected, which would block an autosave mid-sentence.
            recipe.getSteps().clear();
            for (String text : body.steps()) {
                if (!text.isBlank()) {
                    recipe.getSteps().add(new RecipeStep(text.trim()));
                }
            }
        }
        if (body.tags() != null) {
            recipe.getTags().clear();
            recipe.getTags().addAll(body.tags());
        }
        return recipes.save(recipe);
    }

    /**
     * The only place completeness is enforced: a title, at least one
     * ingredient, at least one step, and no blank step.
     */
    public List<ValidationError> validate(Recipe recipe) {
        List<ValidationError> errors = new ArrayList<>();
        if (recipe.getTitle() == null || recipe.getTitle().isBlank()) {
            errors.add(new ValidationError("title", "missing_title"));
        }
        if (recipe.getIngredients().isEmpty()) {
            errors.add(new ValidationError("ingredients", "no_ingredient"));
        }
        // Blank steps are stripped on save, so an empty list is the only way
        // the steps tab can be incomplete.
        if (recipe.getSteps().isEmpty()) {
            errors.add(new ValidationError("steps", "no_step"));
        }
        return errors;
    }

    /** Pinning is its own operation: it must not wait on an autosave. */
    @Transactional
    public Recipe setFavorite(Recipe recipe, boolean favorite) {
        recipe.setFavorite(favorite);
        return recipes.save(recipe);
    }

    @Transactional
    public Recipe publish(Recipe recipe) {
        recipe.setStatus(Recipe.Status.PUBLISHED);
        return recipes.save(recipe);
    }

    @Transactional
    public void delete(Recipe recipe) {
        recipes.delete(recipe);
    }

    private static final java.util.regex.Pattern DURATION =
            java.util.regex.Pattern.compile("(\\d+)\\s*(min|h)", java.util.regex.Pattern.CASE_INSENSITIVE);

    /**
     * Total time read out of the step text — "15 min", "1 h". A step with no
     * stated duration counts as three minutes, which is closer to the truth
     * than counting it as zero.
     */
    public static int minutesFor(Recipe recipe) {
        int total = 0;
        for (RecipeStep step : recipe.getSteps()) {
            var matcher = DURATION.matcher(step.getText());
            int stepMinutes = 0;
            while (matcher.find()) {
                int value = Integer.parseInt(matcher.group(1));
                stepMinutes += matcher.group(2).equalsIgnoreCase("h") ? value * 60 : value;
            }
            total += stepMinutes > 0 ? stepMinutes : 3;
        }
        return total;
    }

    private static String blankToNull(String value) {
        return value.isBlank() ? null : value;
    }
}
