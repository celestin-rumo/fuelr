package ch.celestin.fuelr.nutrition;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Positive;

import java.util.List;

public final class NutritionDtos {

    private NutritionDtos() {
    }

    public record IngredientInput(
            @NotBlank String name,
            @Positive double quantity,
            @NotBlank String unit) {
    }

    public record ComputeRequest(
            @NotEmpty @Valid List<IngredientInput> ingredients,
            @Min(1) int servings) {
    }

    public record Totals(double kcal, double proteinG, double carbsG, double fatG) {
    }

    /** {@code guessed} marks a line no reference food matched — estimated, never presented as measured. */
    public record IngredientBreakdown(
            String name, double kcal, double proteinG, double carbsG, double fatG, boolean guessed) {
    }

    public record Breakdown(
            Totals total,
            Totals perServing,
            int servings,
            boolean containsEstimates,
            List<IngredientBreakdown> ingredients) {
    }
}
