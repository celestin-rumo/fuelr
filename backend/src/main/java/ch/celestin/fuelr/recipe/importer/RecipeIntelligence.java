package ch.celestin.fuelr.recipe.importer;

import java.util.List;

/**
 * Reads a recipe out of something no parser can read.
 *
 * A photo of a cookbook page, a screenshot of somebody's app, a blog that
 * publishes no structured data at all: three inputs with nothing in common
 * except that a model is the only thing that can turn them into ingredients
 * and steps. That is one job, so it is one interface.
 *
 * It is written in nobody's SDK, like {@code PaymentProvider} and for the same
 * reason: the suite touches no network anywhere, and it must stay possible to
 * run every test without a key. The implementation shipped today reads nothing
 * and says so — {@link #available()} is false, and the screen asks before it
 * offers rather than handing somebody a button that fails.
 *
 * Two rules bind whatever implements this. What comes back is a
 * {@link ParsedRecipe} like any other, so a guessed field is flagged with
 * {@code flag()} and a line that could not be read carries {@code needsReview}
 * — the editor already knows how to show both, and nothing invented may arrive
 * looking measured. And the content read is written by a stranger: a page can
 * say "ignore the previous instructions", so the model's answer is data to be
 * validated against a schema, never an instruction to be followed.
 */
public interface RecipeIntelligence {

    /** What the reader is looking at, since the framing advice differs. */
    enum Source {
        /** A page of a cookbook, or a printed card. */
        PHOTO,
        /** A capture of another app, a story, a message. */
        SCREENSHOT
    }

    /** Raised when a read is asked for and no provider is wired. */
    class NotAvailableException extends RuntimeException {
        public NotAvailableException() {
            super("ai_unavailable");
        }
    }

    /** Goes into the logs and onto a usage row; never shown to a cook. */
    String name();

    /**
     * Whether a read can be attempted at all.
     *
     * False while no provider is configured. The screen asks this before
     * offering the option — the same rule as {@code canOrder} on the plan: an
     * offer nobody can honour is worse than saying it is not open yet.
     */
    boolean available();

    /**
     * Reads one recipe out of one or more images.
     *
     * Several because a recipe rarely fits on one page, and the second photo
     * is usually the half of the method that was cut off.
     */
    ParsedRecipe read(List<byte[]> images, Source source);
}
