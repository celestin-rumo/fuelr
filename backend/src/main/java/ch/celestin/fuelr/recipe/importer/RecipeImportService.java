package ch.celestin.fuelr.recipe.importer;

import ch.celestin.fuelr.ai.AiBudget;
import ch.celestin.fuelr.subscription.Entitlements;
import ch.celestin.fuelr.subscription.Feature;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import ch.celestin.fuelr.recipe.Recipe;
import ch.celestin.fuelr.recipe.RecipeIngredient;
import ch.celestin.fuelr.recipe.RecipeRepository;
import ch.celestin.fuelr.recipe.RecipeStep;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

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

    private static final Logger log = LoggerFactory.getLogger(RecipeImportService.class);

    private final SafePageFetcher fetcher;
    private final RecipePageReader reader;
    private final RecipePhotoFetcher photos;
    private final RecipeImportSources sources;
    private final AiBudget budget;
    private final Entitlements entitlements;
    private final RecipeRepository recipes;

    public RecipeImportService(
            SafePageFetcher fetcher, RecipePageReader reader,
            RecipePhotoFetcher photos, RecipeImportSources sources,
            AiBudget budget, Entitlements entitlements, RecipeRepository recipes) {
        this.fetcher = fetcher;
        this.reader = reader;
        this.photos = photos;
        this.sources = sources;
        this.budget = budget;
        this.entitlements = entitlements;
        this.recipes = recipes;
    }

    /** Thrown when the page was reachable but held no recipe we could read. */
    public static class NothingToImportException extends RuntimeException {
        public NothingToImportException() {
            super("no_recipe_found");
        }
    }

    /**
     * Imports from a link.
     *
     * The two schema.org readers run first, always, and they are free. A page
     * that publishes nothing they can find then gets one more chance, from a
     * model reading the page's own words — but only for an account that may
     * use it and has budget left. For everybody else the answer is what it has
     * always been: this page holds nothing we can read, here is manual entry.
     *
     * That order is the whole design. The paid reading is a last resort, never
     * a first one: the parsers cost nothing, are right more often, and a page
     * that publishes its recipe properly should never cost anybody a cent.
     */
    @Transactional
    public Recipe importFrom(Long userId, String url) {
        String html = fetcher.fetch(url);
        RecipePageReader.Reading reading = reader.read(html, url);
        ParsedRecipe parsed = reading.recipe();

        if (parsed.isEmpty()) {
            parsed = assisted(userId, html).orElseThrow(NothingToImportException::new);
        }
        return draftFrom(userId, parsed, url);
    }

    /**
     * One more attempt, with a model, on a page no parser could read.
     *
     * Every reason to decline is a quiet one: no entitlement, nothing wired,
     * no budget left, or a reading that came back empty anyway. The caller
     * turns all of them into the same answer — the page holds nothing — because
     * from where somebody stands that is what happened, and offering to sell
     * them a plan in the middle of a failed import would be reading the room
     * badly.
     */
    private Optional<ParsedRecipe> assisted(Long userId, String html) {
        RecipeIntelligence intelligence = sources.reader();
        if (!entitlements.has(userId, Feature.AI_IMPORT) || !intelligence.available()) {
            return Optional.empty();
        }
        try {
            budget.require(userId);
        } catch (AiBudget.ExhaustedException e) {
            return Optional.empty();
        }

        try {
            RecipeIntelligence.Reading read = intelligence.read(textOf(html));
            budget.record(userId, "IMPORT_PAGE", intelligence.name(),
                    read.usage().inputTokens(), read.usage().outputTokens());
            return read.recipe().isEmpty() ? Optional.empty() : Optional.of(read.recipe());
        } catch (RuntimeException e) {
            log.warn("The assisted reading of a page failed: {}", e.toString());
            return Optional.empty();
        }
    }

    /**
     * The page's words, without its plumbing.
     *
     * Scripts and styles are dropped because they are never the recipe and are
     * most of the bytes. Everything else stays, menus and comments included:
     * deciding what is the recipe is precisely the job being handed over.
     */
    private String textOf(String html) {
        Document document = Jsoup.parse(html);
        document.select("script, style, noscript, svg").remove();
        return document.body() == null ? "" : document.body().text();
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
        // Only ever the library's own filter values: a tag outside that list
        // is a recipe no filter will ever find.
        recipe.getTags().addAll(parsed.getTags());

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
