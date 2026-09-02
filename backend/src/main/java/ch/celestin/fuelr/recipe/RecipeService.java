package ch.celestin.fuelr.recipe;

import ch.celestin.fuelr.recipe.RecipeDtos.IngredientInput;
import ch.celestin.fuelr.recipe.RecipeDtos.SaveRequest;
import ch.celestin.fuelr.recipe.RecipeDtos.ValidationError;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class RecipeService {

    private final RecipeRepository recipes;

    public RecipeService(RecipeRepository recipes) {
        this.recipes = recipes;
    }

    /**
     * Creates an empty draft. Called the moment the editor is opened, before
     * anything has been typed — the recipe has an id from the first click, so
     * every later keystroke is an update to something that already exists.
     */
    @Transactional
    public Recipe createDraft(Long userId) {
        return recipes.save(new Recipe(userId));
    }

    /**
     * Pinned first in the order the author chose, then everything else by most
     * recently touched. The rank only applies among favourites — an unpinned
     * recipe has none and keeps the date ordering.
     */
    static final java.util.Comparator<Recipe> LIBRARY_ORDER =
            java.util.Comparator.comparing(Recipe::isFavorite).reversed()
                    .thenComparing(Recipe::getFavoriteRank,
                            java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder()))
                    .thenComparing(Recipe::getUpdatedAt, java.util.Comparator.reverseOrder());

    public List<Recipe> list(Long userId) {
        return recipes.findByUserIdOrderByFavoriteDescUpdatedAtDesc(userId).stream()
                .sorted(LIBRARY_ORDER)
                .toList();
    }

    /**
     * Filtered list. An empty term and no tags gives the plain list back, so
     * the caller never needs two code paths.
     */
    public List<Recipe> search(Long userId, String term, java.util.Set<String> tags) {
        String normalised = term == null || term.isBlank() ? null
                : "%" + term.trim().toLowerCase() + "%";
        java.util.Set<String> wanted = tags == null ? java.util.Set.of() : tags;
        if (normalised == null && wanted.isEmpty()) {
            return list(userId);
        }
        List<Recipe> found = recipes.search(
                userId, normalised,
                wanted.isEmpty() ? java.util.Set.of("") : wanted,
                wanted.size());
        // The query cannot express the library ordering, so it is applied
        // here rather than left to insertion order.
        return found.stream().sorted(LIBRARY_ORDER).toList();
    }

    public Optional<Recipe> find(Long id, Long userId) {
        return recipes.findByIdAndUserId(id, userId);
    }

    /**
     * Unscoped lookup. Only for a caller that has already established the right
     * to read it some other way — see {@link RecipeAudience}.
     */
    public Optional<Recipe> byId(Long id) {
        return recipes.findById(id);
    }

    /**
     * Saves whatever the author has so far. Never rejects an incomplete
     * recipe: refusing to save a draft is how work gets lost.
     */
    @Transactional
    public Recipe save(Recipe recipe, SaveRequest body) {
        if (body.title() != null) recipe.setTitle(blankToNull(body.title()));
        if (body.description() != null) recipe.setDescription(blankToNull(body.description()));
        if (body.servings() != null) recipe.setServings(body.servings());
        if (body.level() != null) recipe.setLevel(blankToNull(body.level()));

        if (body.ingredients() != null) {
            recipe.getIngredients().clear();
            for (IngredientInput input : body.ingredients()) {
                RecipeIngredient row = new RecipeIngredient(
                        input.name().trim(),
                        BigDecimal.valueOf(input.quantity()),
                        input.unit());
                row.setNeedsReview(input.needsReview());
                recipe.getIngredients().add(row);
            }
        }
        if (body.steps() != null) {
            // A blank step is never persisted. The editor keeps one around
            // while the author is still typing into it, but it has no place
            // in a stored recipe — so it is dropped here rather than
            // rejected, which would block an autosave mid-sentence.
            recipe.getSteps().clear();
            for (String text : body.steps()) {
                if (!text.isBlank()) {
                    recipe.getSteps().add(new RecipeStep(text.trim()));
                }
            }
        }
        if (body.tags() != null) {
            recipe.getTags().clear();
            recipe.getTags().addAll(body.tags());
        }

        // Status is a consequence of the content, not a button someone presses.
        // The editor autosaves, so completeness is re-derived on every save and
        // a recipe that loses its last ingredient falls back to a draft.
        recipe.setStatus(validate(recipe).isEmpty()
                ? Recipe.Status.PUBLISHED
                : Recipe.Status.DRAFT);

        return recipes.save(recipe);
    }

    /**
     * The only place completeness is enforced: a title, at least one
     * ingredient, at least one step, and no blank step.
     */
    public List<ValidationError> validate(Recipe recipe) {
        List<ValidationError> errors = new ArrayList<>();
        if (recipe.getTitle() == null || recipe.getTitle().isBlank()) {
            errors.add(new ValidationError("title", "missing_title"));
        }
        if (recipe.getIngredients().isEmpty()) {
            errors.add(new ValidationError("ingredients", "no_ingredient"));
        }
        // Blank steps are stripped on save, so an empty list is the only way
        // the steps tab can be incomplete.
        if (recipe.getSteps().isEmpty()) {
            errors.add(new ValidationError("steps", "no_step"));
        }
        return errors;
    }

    /** Pinning is its own operation: it must not wait on an autosave. */
    @Transactional
    public Recipe setFavorite(Recipe recipe, boolean favorite) {
        if (recipe.isFavorite() == favorite) {
            return recipe;
        }
        recipe.setFavorite(favorite);
        if (favorite) {
            // Newly pinned goes to the end, so pinning something does not
            // displace the order already chosen.
            recipe.setFavoriteRank(nextRank(recipe.getUserId()));
        } else {
            recipe.setFavoriteRank(null);
            // Close the gap left behind, so un-pinning and re-pinning cannot
            // slowly scatter the remaining ranks.
            compact(recipe.getUserId(), recipe.getId());
        }
        return recipes.save(recipe);
    }

    private int nextRank(Long userId) {
        return favorites(userId).size();
    }

    private List<Recipe> favorites(Long userId) {
        return recipes.findByUserIdOrderByFavoriteDescUpdatedAtDesc(userId).stream()
                .filter(Recipe::isFavorite)
                .sorted(java.util.Comparator.comparing(
                        Recipe::getFavoriteRank,
                        java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder())))
                .collect(java.util.stream.Collectors.toCollection(ArrayList::new));
    }

    private void compact(Long userId, Long excludeId) {
        List<Recipe> ordered = favorites(userId).stream()
                .filter(r -> !r.getId().equals(excludeId))
                .toList();
        for (int i = 0; i < ordered.size(); i++) {
            ordered.get(i).setFavoriteRank(i);
        }
        recipes.saveAll(ordered);
    }

    /**
     * Moves a pinned recipe one position. Only favourites have a rank, so the
     * unpinned list is untouched and keeps its updated-at ordering.
     */
    @Transactional
    public void moveFavorite(Recipe recipe, int direction) {
        if (!recipe.isFavorite()) {
            throw new IllegalArgumentException("Seules les recettes épinglées ont un ordre.");
        }
        List<Recipe> ordered = favorites(recipe.getUserId());
        int index = -1;
        for (int i = 0; i < ordered.size(); i++) {
            if (ordered.get(i).getId().equals(recipe.getId())) {
                index = i;
                break;
            }
        }
        int target = index + direction;
        if (index < 0 || target < 0 || target >= ordered.size()) {
            return;
        }
        Recipe swapped = ordered.get(target);
        ordered.set(target, ordered.get(index));
        ordered.set(index, swapped);
        for (int i = 0; i < ordered.size(); i++) {
            ordered.get(i).setFavoriteRank(i);
        }
        recipes.saveAll(ordered);
    }

    /** Saves a photo change alone, without re-deriving the completion status. */
    @Transactional
    public Recipe savePhoto(Recipe recipe) {
        return recipes.save(recipe);
    }

    /** A copy the author can edit freely, with no link back to the original. */
    @Transactional
    public Recipe duplicate(Recipe source, String copySuffix) {
        Recipe copy = new Recipe(source.getUserId());
        copy.setTitle(source.getTitle() == null ? null : source.getTitle() + copySuffix);
        copy.setDescription(source.getDescription());
        copy.setServings(source.getServings());
        copy.setLevel(source.getLevel());
        // A copy starts as a draft even when the original was published: it has
        // not been reviewed yet.
        copy.setStatus(Recipe.Status.DRAFT);
        source.getIngredients().forEach(i -> copy.getIngredients().add(
                new RecipeIngredient(i.getName(), i.getQuantity(), i.getUnit())));
        source.getSteps().forEach(s -> copy.getSteps().add(new RecipeStep(s.getText())));
        copy.getTags().addAll(source.getTags());
        return recipes.save(copy);
    }

    @Transactional
    public Recipe publish(Recipe recipe) {
        recipe.setStatus(Recipe.Status.PUBLISHED);
        // Publishing is the cook saying the recipe is right. Whatever the
        // import was unsure of has now been looked at, by definition.
        recipe.setUnverified(null);
        return recipes.save(recipe);
    }

    @Transactional
    public void delete(Recipe recipe) {
        Long userId = recipe.getUserId();
        boolean wasFavorite = recipe.isFavorite();
        recipes.delete(recipe);
        if (wasFavorite) {
            compact(userId, recipe.getId());
        }
    }

    /** Longest first, so "minutes" is never read as "min" followed by "utes". */
    private static final String UNIT = "minutes?|minuten|mins?|mn|heures?|hours?|stunden?|std|h";

    /** A unit must not begin a longer word: "5 minimum" states no duration. */
    private static final String NOT_LETTER = "(?![a-zA-ZÀ-ÖØ-öø-ÿ])";

    /**
     * One duration, as a step writes it.
     *
     * The trailing group is what makes "1 h 30" ninety minutes rather than
     * sixty. It is refused when that number carries a unit of its own, so
     * "1 h 30 min" still reads as two durations adding to the same ninety —
     * and {@code (?!\d)} stops it settling for the "3" of "30", which would
     * quietly make the step 63 minutes long.
     *
     * The frontend parses the same text to offer the timers, in
     * {@code app/lib/durations.ts}. The two are one rule written twice, and
     * {@code RecipeDurationTest} runs the same table as {@code durations.test.ts}:
     * if they disagree, a card promises a total no timer can account for.
     */
    private static final java.util.regex.Pattern DURATION =
            java.util.regex.Pattern.compile(
                    "(\\d+)\\s*(" + UNIT + ")" + NOT_LETTER
                            + "(?:\\s*(\\d{1,2})(?!\\d)(?!\\s*(?:" + UNIT + ")" + NOT_LETTER + "))?",
                    java.util.regex.Pattern.CASE_INSENSITIVE);

    /**
     * Total time read out of the step text — "15 min", "1 h 30", "20 Minuten".
     * A step with no stated duration counts as three minutes, which is closer
     * to the truth than counting it as zero.
     */
    public static int minutesFor(Recipe recipe) {
        int total = 0;
        for (RecipeStep step : recipe.getSteps()) {
            total += minutesIn(step.getText());
        }
        return total;
    }

    /** What one step states, or three minutes when it states nothing. */
    static int minutesIn(String text) {
        var matcher = DURATION.matcher(text);
        int stepMinutes = 0;
        while (matcher.find()) {
            int value = Integer.parseInt(matcher.group(1));
            // "min", "mins", "minute", "minuten", "mn" — everything else is an hour.
            boolean hours = !matcher.group(2).toLowerCase().startsWith("m");
            int extra = hours && matcher.group(3) != null ? Integer.parseInt(matcher.group(3)) : 0;
            stepMinutes += hours ? value * 60 + extra : value;
        }
        return stepMinutes > 0 ? stepMinutes : 3;
    }

    private static String blankToNull(String value) {
        return value.isBlank() ? null : value;
    }
}
