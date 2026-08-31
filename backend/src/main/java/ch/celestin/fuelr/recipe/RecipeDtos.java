package ch.celestin.fuelr.recipe;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import java.util.List;
import java.util.Set;

public final class RecipeDtos {

    private RecipeDtos() {
    }

    /**
     * Autosave payload. Nothing here is required: a draft is saved exactly as
     * typed, half-finished included. Completeness is checked at publish time,
     * not on every keystroke.
     */
    public record SaveRequest(
            String title,
            String description,
            @Min(1) @Max(12) Integer servings,
            String level,
            List<IngredientInput> ingredients,
            List<String> steps,
            Set<String> tags) {
    }

    public record IngredientInput(String name, double quantity, String unit) {
    }

    public record IngredientView(Long id, String name, double quantity, String unit) {
    }

    public record RecipeView(
            Long id,
            String title,
            String description,
            int servings,
            String level,
            String status,
            List<IngredientView> ingredients,
            List<String> steps,
            Set<String> tags) {
    }

    public record RecipeSummary(
            Long id, String title, String status, int servings,
            int ingredientCount, int stepCount) {
    }

    /** What blocks publishing, so the editor can point at the right tab. */
    public record ValidationError(String field, String message) {
    }
}
