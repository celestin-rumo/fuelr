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

    /**
     * What the grid needs to let someone choose a recipe at a glance: how long
     * it takes, what it costs nutritionally, and whether it is pinned.
     * {@code estimated} travels with the figures so the card can mark a
     * guessed value rather than passing it off as measured.
     */
    public record RecipeSummary(
            Long id, String title, String status, int servings,
            int ingredientCount, int stepCount,
            boolean favorite, int minutes,
            Double kcalPerServing, Double proteinPerServing,
            Double carbsPerServing, Double fatPerServing,
            boolean estimated) {
    }

    /** What blocks publishing, so the editor can point at the right tab. */
    public record ValidationError(String field, String message) {
    }
}
