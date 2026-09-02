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

    /** Everything past the four headline figures, per serving. */
    public record DetailedTotals(
            double kcal, double proteinG, double carbsG, double fatG,
            double fibreG, double sugarsG, double saltG) {
    }

    /** One measured vitamin or mineral. {@code unit} is "mg", "ug" or "g". */
    public record NutrientAmount(String code, double amount, String unit) {
    }

    /**
     * The paid detail. {@code containsEstimates} means at least one ingredient
     * fell through to the flat guess — which contributes no micronutrients at
     * all, so the vitamins shown are only ever from foods that were recognised.
     */
    public record Detail(
            DetailedTotals total,
            DetailedTotals perServing,
            int servings,
            boolean containsEstimates,
            List<NutrientAmount> micronutrients,
            List<IngredientBreakdown> ingredients) {
    }

    public record Breakdown(
            Totals total,
            Totals perServing,
            int servings,
            boolean containsEstimates,
            List<IngredientBreakdown> ingredients) {
    }
}
