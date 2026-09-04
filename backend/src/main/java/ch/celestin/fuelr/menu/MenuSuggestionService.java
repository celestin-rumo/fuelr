package ch.celestin.fuelr.menu;

import ch.celestin.fuelr.ai.AiBudget;
import ch.celestin.fuelr.nutrition.FoodMatcher;
import ch.celestin.fuelr.recipe.Recipe;
import ch.celestin.fuelr.recipe.RecipeIngredient;
import ch.celestin.fuelr.recipe.RecipeService;
import ch.celestin.fuelr.subscription.Entitlements;
import ch.celestin.fuelr.subscription.Feature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * What to cook, from what is in the bag.
 *
 * The cook's own recipes are searched first, and that is not an optimisation.
 * Suggesting a dish somebody has already written beats inventing one: they
 * know they like it, the quantities are theirs, it has a photo, and it costs
 * nothing to find. A model is asked only for what the library could not
 * answer, and only when it is allowed to be.
 *
 * Nothing here writes a recipe. A suggestion is a proposal — an existing one
 * opens, an invented one becomes a draft the cook corrects — which is the same
 * rule every import in this application follows.
 */
@Service
public class MenuSuggestionService {

    private static final Logger log = LoggerFactory.getLogger(MenuSuggestionService.class);

    /** Enough to choose between, few enough to read standing up. */
    private static final int WANTED = 5;

    /**
     * How many of the cook's own recipes make an answer on their own.
     *
     * Three is a choice; one is a coincidence. Below this the library is topped
     * up with ideas, above it nothing is asked of a model and nothing is spent
     * — which is what makes "your own recipes first" more than an ordering.
     */
    private static final int ENOUGH_FROM_LIBRARY = 3;

    /** A recipe has to use more than one thing before it is worth proposing. */
    private static final int ENOUGH_MATCHES = 2;

    private final RecipeService recipes;
    private final Entitlements entitlements;
    private final AiBudget budget;
    private final List<MenuIntelligence> readers;

    public MenuSuggestionService(
            RecipeService recipes, Entitlements entitlements,
            AiBudget budget, List<MenuIntelligence> readers) {
        this.recipes = recipes;
        this.entitlements = entitlements;
        this.budget = budget;
        this.readers = readers;
    }

    /** The reader in use, which is the one that reads nothing when none is wired. */
    public MenuIntelligence reader() {
        return readers.stream()
                .filter(MenuIntelligence::available)
                .findFirst()
                .orElse(readers.get(readers.size() - 1));
    }

    public MenuDtos.SuggestionsView suggest(Long userId, String have) {
        Set<String> wanted = words(have);

        List<MenuDtos.Suggestion> found = new ArrayList<>(fromLibrary(userId, wanted));
        boolean assisted = false;

        if (found.size() < ENOUGH_FROM_LIBRARY) {
            List<MenuDtos.Suggestion> ideas = fromModel(userId, have, found);
            assisted = !ideas.isEmpty();
            found.addAll(ideas);
        }
        return new MenuDtos.SuggestionsView(
                found.stream().limit(WANTED).toList(), assisted);
    }

    // --- the library, which costs nothing ------------------------------------

    /**
     * The cook's own recipes, ranked by how much of the bag they use.
     *
     * Matched on normalised words rather than on the reference food table:
     * somebody typing "courgettes" and a recipe saying "courgette" are the same
     * ingredient, and that is as clever as this needs to be. What is missing is
     * everything the recipe wants that the bag does not hold — which is exactly
     * what the shopping list wants to be handed.
     */
    private List<MenuDtos.Suggestion> fromLibrary(Long userId, Set<String> wanted) {
        record Scored(Recipe recipe, long matches, List<String> missing) {
        }

        return recipes.list(userId).stream()
                .map(recipe -> {
                    List<String> missing = new ArrayList<>();
                    long matches = 0;
                    for (RecipeIngredient line : recipe.getIngredients()) {
                        if (mentions(wanted, line.getName())) {
                            matches++;
                        } else {
                            missing.add(line.getName());
                        }
                    }
                    return new Scored(recipe, matches, missing);
                })
                .filter(scored -> scored.matches() >= ENOUGH_MATCHES)
                // Most of the bag used first, then the shortest shopping left.
                .sorted(Comparator.comparingLong(Scored::matches).reversed()
                        .thenComparingInt(scored -> scored.missing().size()))
                .map(scored -> new MenuDtos.Suggestion(
                        MenuDtos.Origin.RECIPE.name(),
                        scored.recipe().getId(),
                        scored.recipe().getTitle(),
                        RecipeService.minutesFor(scored.recipe()),
                        scored.recipe().getPhotoPath() != null,
                        scored.missing(),
                        List.of(),
                        List.of()))
                .limit(WANTED)
                .toList();
    }

    private boolean mentions(Set<String> wanted, String ingredient) {
        Set<String> written = words(ingredient);
        return written.stream().anyMatch(wanted::contains);
    }

    /**
     * The words of a line, normalised and stripped of the ones that carry no
     * ingredient — a quantity, a unit, an article.
     */
    private Set<String> words(String written) {
        return Arrays.stream(FoodMatcher.normalise(written).split("[^a-z0-9]+"))
                .filter(word -> word.length() > 2)
                .filter(word -> !NOISE.contains(word))
                .map(MenuSuggestionService::singular)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    /** Crude on purpose: "courgettes" and "courgette" are the same bag. */
    private static String singular(String word) {
        return word.endsWith("s") && word.length() > 3 ? word.substring(0, word.length() - 1) : word;
    }

    private static final Set<String> NOISE = Set.of(
            "des", "les", "une", "unes", "aux", "avec", "pour", "dans", "sur",
            "gramme", "grammes", "kilo", "kilos", "litre", "litres",
            "cuillere", "cuilleres", "pincee", "peu", "bien", "tres");

    // --- the model, which does not ------------------------------------------

    /**
     * Ideas for what the library could not answer.
     *
     * Declined quietly for every reason there is — no entitlement, nothing
     * wired, no budget, an answer that came back empty. The library's
     * suggestions still stand, and a screen that offered to sell a plan in the
     * middle of answering a question would be reading the room badly.
     */
    private List<MenuDtos.Suggestion> fromModel(
            Long userId, String have, List<MenuDtos.Suggestion> already) {
        MenuIntelligence intelligence = reader();
        if (!entitlements.has(userId, Feature.AI_MENU) || !intelligence.available()) {
            return List.of();
        }
        try {
            budget.require(userId);
        } catch (AiBudget.ExhaustedException e) {
            return List.of();
        }

        try {
            MenuIntelligence.Ideas ideas = intelligence.suggest(
                    have,
                    WANTED - already.size(),
                    already.stream().map(MenuDtos.Suggestion::title).toList());
            budget.record(userId, "MENU_SUGGESTIONS", intelligence.name(),
                    ideas.usage().inputTokens(), ideas.usage().outputTokens());
            return ideas.suggestions();
        } catch (RuntimeException e) {
            log.warn("No ideas came back: {}", e.toString());
            return List.of();
        }
    }
}
