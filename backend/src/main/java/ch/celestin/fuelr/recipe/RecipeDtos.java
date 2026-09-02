package ch.celestin.fuelr.recipe;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

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
            Set<String> tags,
            /** Zero, one or several of SPRING, SUMMER, AUTUMN, WINTER. */
            Set<String> seasons) {
    }

    /**
     * {@code needsReview} travels back and forth so an import's doubt survives
     * autosave. It clears when the cook replaces the line — which is the only
     * act that actually resolves it. Absent in a hand-written payload, and
     * false is the right default there.
     */
    public record IngredientInput(
            String name, double quantity, String unit, boolean needsReview) {
    }

    /**
     * {@code needsReview} marks a line an import could not read into a quantity
     * and a unit, so the editor can ask rather than pass a guess off as read.
     */
    public record IngredientView(
            Long id, String name, double quantity, String unit, boolean needsReview) {
    }

    public record RecipeView(
            Long id,
            String title,
            String description,
            int servings,
            String level,
            String status,
            boolean hasPhoto,
            List<IngredientView> ingredients,
            List<String> steps,
            Set<String> tags,
            Set<String> seasons,
            String sourceUrl,
            Integer totalMinutes,
            /** Field names the import had to guess at: "servings", "steps", "title". */
            Set<String> unverified) {
    }

    public record ImportRequest(@NotBlank String url) {
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
            boolean favorite, boolean hasPhoto, int minutes,
            Double kcalPerServing, Double proteinPerServing,
            Double carbsPerServing, Double fatPerServing,
            boolean estimated,
            Set<String> seasons) {
    }

    /** What blocks publishing, so the editor can point at the right tab. */
    public record ValidationError(String field, String message) {
    }
}
