package ch.celestin.fuelr.recipe.illustration;

import ch.celestin.fuelr.ai.AiBudget;
import ch.celestin.fuelr.media.MediaStorage;
import ch.celestin.fuelr.recipe.Recipe;
import ch.celestin.fuelr.recipe.RecipeIngredient;
import ch.celestin.fuelr.recipe.RecipeRepository;
import ch.celestin.fuelr.subscription.Entitlements;
import ch.celestin.fuelr.subscription.Feature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.Normalizer;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;

/**
 * A picture for every dish a model wrote, drawn after the fact.
 *
 * Runs after `POST /api/recipes/from-idea` has answered, on its own pool:
 * the answer is the recipe, and the picture is a few seconds behind it. Until
 * it lands the row shows the tile drawn from the title, so nothing waits and
 * nothing is missing. It is paid per picture, so it goes through the same
 * gates as every other call — the plan, the month's budget — and it is
 * recorded in `ai_usage` the moment the provider has answered, whether or
 * not the bytes then turn out to be usable: the money is spent either way.
 *
 * What the picture is made *from* is the title and the ingredient names,
 * and nothing else about the person. That is what leaves for the provider,
 * and the privacy page says so.
 */
@Service
public class IllustrationService {

    private static final Logger log = LoggerFactory.getLogger(IllustrationService.class);

    /** The first few lines say what the dish is; the salt does not help. */
    private static final int INGREDIENTS_IN_PROMPT = 6;

    /** A proposal nobody kept is swept with its picture after this. */
    private static final Duration KEPT_FOR = Duration.ofDays(7);

    private final RecipeRepository recipes;
    private final IdeaIllustrationRepository ideas;
    private final MediaStorage media;
    private final List<RecipeIllustrator> illustrators;
    private final AiBudget budget;
    private final Entitlements entitlements;
    private final long priceMicros;

    public IllustrationService(RecipeRepository recipes, IdeaIllustrationRepository ideas,
                               MediaStorage media, List<RecipeIllustrator> illustrators,
                               AiBudget budget, Entitlements entitlements,
                               @Value("${app.ai.illustration.price-micros:3000}") long priceMicros) {
        this.recipes = recipes;
        this.ideas = ideas;
        this.media = media;
        this.illustrators = illustrators;
        this.budget = budget;
        this.entitlements = entitlements;
        this.priceMicros = priceMicros;
    }

    /** Whether anything will be drawn at all: what the proposals' keys are worth. */
    public boolean available() {
        return illustrator().available();
    }

    /**
     * The key a proposal carries, from its title alone: an idea has no id,
     * and the same dish proposed twice is the same picture. Normalised so
     * "Dahl de lentilles" and "dahl de lentilles " agree, hashed so it is
     * one short token in a URL.
     */
    public static String keyOf(String title) {
        String plain = Normalizer.normalize(title == null ? "" : title, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(java.util.Locale.ROOT)
                .replaceAll("[^a-z0-9]+", " ")
                .trim();
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(plain.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest).substring(0, 32);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /**
     * Draws a picture for a dish the moment its title is known — while the
     * model is still writing the next one — so that by the time the answer
     * is on screen most of the pictures are too, and keeping a dish opens
     * a draft that already has its photo. Paid like every other call, and
     * once per dish: a title already drawn for this account is not drawn
     * again.
     */
    @Async("illustrationExecutor")
    @Transactional
    public void illustrateIdea(Long userId, String title) {
        if (title == null || title.isBlank()) {
            return;
        }
        RecipeIllustrator illustrator = illustrator();
        if (!illustrator.available() || !entitlements.has(userId, Feature.AI_MENU)) {
            return;
        }
        String key = keyOf(title);
        if (ideas.findByUserIdAndTitleKey(userId, key).isPresent()) {
            return;
        }
        try {
            budget.require(userId);
        } catch (AiBudget.ExhaustedException e) {
            return;
        }
        String stored = null;
        try {
            byte[] bytes = illustrator.illustrate(promptFor(title, List.of())).orElse(null);
            if (bytes == null) {
                return;
            }
            budget.record(userId, "ILLUSTRATION", illustrator.name(), priceMicros);
            stored = media.store(bytes);
            ideas.saveAndFlush(new IdeaIllustration(userId, key, title.trim(), stored));
        } catch (DataIntegrityViolationException raced) {
            // Two rounds proposing the same dish at once: the first one wins
            // and the second picture is not kept.
            media.delete(stored);
        } catch (RuntimeException e) {
            log.warn("No illustration for idea '{}': {}", title, e.toString());
        }
    }

    /**
     * When a proposed dish becomes a draft: its picture, if drawn, becomes
     * the recipe's photo right now — the file changes hands, the row goes —
     * so the draft opens with it. Otherwise the picture is drawn behind the
     * answer as before.
     */
    @Transactional
    public boolean attach(Long userId, Recipe recipe) {
        Optional<IdeaIllustration> drawn = ideas.findByUserIdAndTitleKey(userId, keyOf(recipe.getTitle()));
        if (drawn.isEmpty() || recipe.getPhotoPath() != null) {
            return false;
        }
        recipe.setPhotoPath(drawn.get().getPhotoPath());
        recipe.setPhotoOrigin(Recipe.PhotoOrigin.GENERATED);
        recipes.save(recipe);
        ideas.delete(drawn.get());
        return true;
    }

    /** The picture drawn for one of this account's proposals, if it has landed. */
    public Optional<IdeaIllustration> find(Long userId, String key) {
        return ideas.findByUserIdAndTitleKey(userId, key);
    }

    /** Hourly: what nobody kept for a week goes, file first. */
    @Scheduled(fixedDelay = 3_600_000)
    @Transactional
    public void sweep() {
        for (IdeaIllustration old : ideas.findByCreatedAtBefore(Instant.now().minus(KEPT_FOR))) {
            try {
                media.delete(old.getPhotoPath());
            } catch (RuntimeException e) {
                log.warn("Could not delete {}: {}", old.getPhotoPath(), e.toString());
            }
            ideas.delete(old);
        }
    }

    /** The illustrator in use, which is the one that draws nothing when none is wired. */
    public RecipeIllustrator illustrator() {
        return illustrators.stream()
                .filter(RecipeIllustrator::available)
                .findFirst()
                .orElse(illustrators.get(illustrators.size() - 1));
    }

    @Async("illustrationExecutor")
    @Transactional
    public void illustrate(Long userId, Long recipeId) {
        RecipeIllustrator illustrator = illustrator();
        if (!illustrator.available() || !entitlements.has(userId, Feature.AI_MENU)) {
            return;
        }
        try {
            budget.require(userId);
        } catch (AiBudget.ExhaustedException e) {
            return;
        }
        Recipe recipe = recipes.findById(recipeId).orElse(null);
        if (recipe == null || recipe.getPhotoPath() != null) {
            return;
        }
        try {
            byte[] bytes = illustrator.illustrate(promptFor(recipe.getTitle(),
                    recipe.getIngredients().stream().map(RecipeIngredient::getName).toList())).orElse(null);
            if (bytes == null) {
                return;
            }
            budget.record(userId, "ILLUSTRATION", illustrator.name(), priceMicros);
            // Believed exactly as far as an upload is: sniffed and capped.
            String stored = media.store(bytes);
            recipe.setPhotoPath(stored);
            recipe.setPhotoOrigin(Recipe.PhotoOrigin.GENERATED);
            recipes.save(recipe);
        } catch (RuntimeException e) {
            // A dish without a picture is a dish without a picture, not a failure.
            log.warn("No illustration for recipe {}: {}", recipeId, e.toString());
        }
    }

    /**
     * English, because that is what the model was trained on; the dish's
     * name stays as written. Overhead, daylight, no text: a picture that
     * reads as a plate at 44 pixels, and never as a poster. The ingredients
     * help when there are any; a proposal is drawn from its title alone.
     */
    static String promptFor(String title, List<String> ingredients) {
        StringBuilder prompt = new StringBuilder("Food photograph of ")
                .append(title == null || title.isBlank() ? "a dish" : title.trim());
        List<String> names = ingredients.stream()
                .filter(name -> name != null && !name.isBlank())
                .limit(INGREDIENTS_IN_PROMPT)
                .toList();
        if (!names.isEmpty()) {
            prompt.append(", made with ").append(String.join(", ", names));
        }
        prompt.append(". Plated and ready to eat, overhead view, soft natural daylight,")
                .append(" rustic wooden table, shallow depth of field, no text, no people.");
        return prompt.toString();
    }
}
