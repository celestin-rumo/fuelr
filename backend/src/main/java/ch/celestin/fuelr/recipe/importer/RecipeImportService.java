package ch.celestin.fuelr.recipe.importer;

import ch.celestin.fuelr.ai.AiBudget;
import ch.celestin.fuelr.recipe.Recipe;
import ch.celestin.fuelr.recipe.RecipeIngredient;
import ch.celestin.fuelr.recipe.RecipeRepository;
import ch.celestin.fuelr.recipe.RecipeStep;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

/**
 * Turns a link into a draft the cook can correct.
 *
 * Two rules shape the whole thing. Nothing is published: the import always
 * produces a DRAFT and opens the editor, so a page read badly is a starting
 * point rather than a wrong recipe silently added to the library. And nothing
 * is invented: every value the parser had to guess at is flagged, so the editor
 * can ask instead of presenting a plausible number as a fact.
 */
@Service
public class RecipeImportService {

    private final SafePageFetcher fetcher;
    private final RecipePageReader reader;
    private final RecipePhotoFetcher photos;
    private final RecipeImportSources sources;
    private final AiBudget budget;
    private final RecipeRepository recipes;

    public RecipeImportService(
            SafePageFetcher fetcher, RecipePageReader reader,
            RecipePhotoFetcher photos, RecipeImportSources sources,
            AiBudget budget, RecipeRepository recipes) {
        this.fetcher = fetcher;
        this.reader = reader;
        this.photos = photos;
        this.sources = sources;
        this.budget = budget;
        this.recipes = recipes;
    }

    /** Thrown when the page was reachable but held no recipe we could read. */
    public static class NothingToImportException extends RuntimeException {
        public NothingToImportException() {
            super("no_recipe_found");
        }
    }

    @Transactional
    public Recipe importFrom(Long userId, String url) {
        String html = fetcher.fetch(url);
        RecipePageReader.Reading reading = reader.read(html, url);
        return draftFrom(userId, reading.recipe(), url);
    }

    /**
     * Imports from photos or screenshots, which only a model can read.
     *
     * The same draft comes out as from a link — DRAFT, every guess flagged,
     * the editor opened on it — because the cook's job afterwards is the same
     * whichever door the recipe came through. What differs is only who did the
     * reading, and that nothing here has a source URL to remember.
     */
    @Transactional
    public Recipe importFromImages(
            Long userId, List<byte[]> images, RecipeIntelligence.Source source) {
        // Asked before the call, because afterwards the money is spent.
        budget.require(userId);

        RecipeIntelligence reader = sources.reader();
        RecipeIntelligence.Reading reading = reader.read(images, source);

        // Recorded in its own transaction: what comes next can fail — a photo
        // of a blank page produces nothing — and the provider has been paid
        // either way.
        budget.record(userId, "IMPORT_" + source.name(), reader.name(),
                reading.usage().inputTokens(), reading.usage().outputTokens());

        // The first photo would make a decent recipe photo, and probably will.
        // Storing an illustration for a recipe that failed to import would be
        // worse than storing nothing.
        return draftFrom(userId, reading.recipe(), null);
    }

    private Recipe draftFrom(Long userId, ParsedRecipe parsed, String url) {
        if (parsed.isEmpty()) {
            throw new NothingToImportException();
        }

        Recipe recipe = new Recipe(userId);
        recipe.setSourceUrl(url);
        recipe.setTitle(parsed.getTitle());
        recipe.setDescription(parsed.getDescription());
        recipe.setTotalMinutes(parsed.getTotalMinutes());

        if (parsed.getServings() != null) {
            recipe.setServings(parsed.getServings());
        }

        for (ParsedRecipe.ParsedIngredient ingredient : parsed.getIngredients()) {
            RecipeIngredient row = new RecipeIngredient(
                    ingredient.name(),
                    BigDecimal.valueOf(ingredient.quantity()),
                    ingredient.unit());
            row.setNeedsReview(ingredient.needsReview());
            recipe.getIngredients().add(row);
        }
        for (String step : parsed.getSteps()) {
            recipe.getSteps().add(new RecipeStep(step));
        }

        // The photo is a bonus, so it never decides whether the import worked:
        // a page with none, an image that is too heavy, or one that turns out
        // to be something other than an image all leave the draft standing.
        // Where it came from stays visible either way — the recipe carries its
        // sourceUrl — and the cook can replace or remove it like any other.
        photos.fetch(parsed.getImageUrl()).ifPresent(recipe::setPhotoPath);

        // A source that gives ingredients but withholds its method — Cookidoo
        // does exactly this, the steps being what the subscription pays for.
        // Worth importing what there is, and worth saying what is missing.
        if (parsed.getSteps().isEmpty()) {
            parsed.flag("steps");
        }
        if (parsed.getTitle() == null || parsed.getTitle().isBlank()) {
            parsed.flag("title");
        }

        recipe.setUnverified(parsed.getUnverified().isEmpty()
                ? null : String.join(",", parsed.getUnverified()));

        // Status stays DRAFT: publishing is the cook's decision, made in the
        // editor once they have looked at what arrived.
        return recipes.save(recipe);
    }

    /** Which readings this build can attempt, in the order they are tried. */
    public List<String> readings() {
        return reader.parserNames();
    }
}
