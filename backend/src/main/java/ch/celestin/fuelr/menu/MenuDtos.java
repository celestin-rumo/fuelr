package ch.celestin.fuelr.menu;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public final class MenuDtos {

    private MenuDtos() {
    }

    /**
     * What somebody has, written the way they would say it.
     *
     * One free line — "poulet, courgettes, riz, du citron" — because asking a
     * tired cook to fill a structured form is asking them to do the work the
     * feature exists to remove.
     */
    public record SuggestRequest(
            @NotBlank @Size(max = 600) String have) {
    }

    /**
     * Where a suggestion came from, which decides what happens when it is
     * taken and what it may claim.
     *
     * {@code RECIPE} is one the cook already wrote: it opens, it has its own
     * photo, and nothing about it was invented. {@code IDEA} came from a model
     * and becomes a draft to correct, like every import.
     */
    public enum Origin { RECIPE, IDEA }

    public record Ingredient(String name, double quantity, String unit, boolean needsReview) {
    }

    public record Suggestion(
            String origin,
            /** Set for a recipe already in the library, null for an idea. */
            Long recipeId,
            String title,
            Integer minutes,
            /** True when the library recipe carries a photo of its own. */
            boolean hasPhoto,
            /** What the cook does not have, named so it can go on a list. */
            List<String> missing,
            /** An idea carries enough to become a draft without a second call. */
            List<Ingredient> ingredients,
            List<String> steps) {
    }

    /**
     * {@code assisted} says whether a model was asked at all. The library is
     * searched first and for free, so a cook whose own recipes answered the
     * question is told nothing was spent.
     */
    public record SuggestionsView(List<Suggestion> suggestions, boolean assisted) {
    }
}
