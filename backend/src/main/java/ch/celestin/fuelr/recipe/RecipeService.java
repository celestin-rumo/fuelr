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
        return recipes.findByUserIdOrderByUpdatedAtDesc(userId);
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
            recipe.getSteps().clear();
            for (String text : body.steps()) {
                recipe.getSteps().add(new RecipeStep(text));
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
        if (recipe.getSteps().isEmpty()) {
            errors.add(new ValidationError("steps", "no_step"));
        } else if (recipe.getSteps().stream().anyMatch(s -> s.getText().isBlank())) {
            errors.add(new ValidationError("steps", "empty_step"));
        }
        return errors;
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

    private static String blankToNull(String value) {
        return value.isBlank() ? null : value;
    }
}
