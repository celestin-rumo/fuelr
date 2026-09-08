package ch.celestin.fuelr.recipe.illustration;

import java.util.Optional;

/**
 * A picture for a dish nobody has cooked.
 *
 * Anthropic's models read images and write text; none of them draws. So
 * this is a second seam, beside `MenuIntelligence`, for a different kind of
 * model — an image model behind an HTTP API — and it is written in nobody's
 * SDK so the suite still touches no network. What it returns is bytes, and
 * they are believed exactly as far as an upload is: sniffed, capped, stored.
 */
public interface RecipeIllustrator {

    String name();

    /** False while no token is configured; the dish keeps its drawn tile. */
    boolean available();

    /**
     * @param prompt what to draw, in the model's own language (English)
     * @return the image's bytes, or empty when the model answered nothing
     */
    Optional<byte[]> illustrate(String prompt);
}
