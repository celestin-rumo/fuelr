package ch.celestin.fuelr.plan;

import ch.celestin.fuelr.recipe.Cuisine;
import ch.celestin.fuelr.recipe.Recipe;
import ch.celestin.fuelr.recipe.RecipeService;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * A week, filled in a direction somebody asked for.
 *
 * The sibling of `MenuSuggestionService`, entered from the other end: that one
 * starts from what is in the bag, this one from what somebody *wants* — light,
 * high in protein, Italian. And it happens in the planner rather than on a
 * screen of its own, because filling the week is when the question comes up.
 *
 * **The library answers first, and here that is not only cheaper — it is
 * free.** An intention is a tag and a cuisine is a column, so "the recipes I
 * already wrote that match this" is a query. Nothing is asked of a model until
 * the library has run out, which means the common case — somebody with thirty
 * recipes asking for something vegetarian — costs nothing at all.
 *
 * Nothing here writes to the plan. It proposes; accepting is a separate act,
 * meal by meal or all at once, and that is what the correction story is built
 * on.
 */
@Service
public class WeekSuggestionService {

    /**
     * What a proposal is: a recipe, on a day, in a slot, with why it was
     * chosen.
     *
     * The reason travels because a suggestion nobody can account for is a
     * suggestion nobody trusts — and because the correction story needs to
     * show what it is replacing.
     */
    public record Proposal(
            LocalDate date,
            MealSlot slot,
            Long recipeId,
            String title,
            Integer minutes,
            String cuisine,
            Set<String> tags,
            boolean hasPhoto,
            /** MATCHED_INTENT, MATCHED_CUISINE, LIBRARY — never invented here. */
            String because) {
    }

    public record Suggestion(
            List<Proposal> proposals,
            /** How many slots were asked for and could not be filled. */
            int unfilled,
            /** True when the library alone could not answer. */
            boolean libraryExhausted) {
    }

    /** What somebody asked for. Both halves are optional, and often both are set. */
    public record Wanted(
            Set<String> intents,
            Set<String> cuisines,
            List<LocalDate> days,
            List<MealSlot> slots,
            /** Recipes not to propose: already on the plan, or already refused. */
            Set<Long> exclude) {
    }

    private final RecipeService recipes;

    public WeekSuggestionService(RecipeService recipes) {
        this.recipes = recipes;
    }

    /**
     * Fills the asked-for slots from the cook's own recipes.
     *
     * Ranked by how well each one answers, then spread: the same dish twice in
     * a week is a proposal somebody deletes rather than reads. When there are
     * fewer matching recipes than slots, the rest come back unfilled rather
     * than repeated — saying "I found four" is an answer; showing the same
     * four dishes twice is not.
     */
    public Suggestion fromLibrary(Long userId, Wanted wanted) {
        Set<String> intents = wanted.intents() == null ? Set.of() : wanted.intents();
        Set<String> cuisines = wanted.cuisines() == null ? Set.of() : wanted.cuisines();
        Set<Long> exclude = wanted.exclude() == null ? Set.of() : wanted.exclude();

        List<Recipe> matching = recipes.list(userId).stream()
                .filter(recipe -> !exclude.contains(recipe.getId()))
                // A draft is a recipe somebody has not finished writing. It has
                // no business being proposed for Thursday.
                .filter(recipe -> recipe.getStatus() == Recipe.Status.PUBLISHED)
                .filter(recipe -> matchesIntent(recipe, intents))
                .filter(recipe -> matchesCuisine(recipe, cuisines))
                .sorted(bestFirst(intents))
                .toList();

        List<Proposal> proposals = new ArrayList<>();
        Set<Long> used = new LinkedHashSet<>();
        int at = 0;

        for (LocalDate day : wanted.days()) {
            for (MealSlot slot : wanted.slots()) {
                // Each recipe once. Running out is an honest answer.
                while (at < matching.size() && used.contains(matching.get(at).getId())) {
                    at++;
                }
                if (at >= matching.size()) {
                    break;
                }
                Recipe recipe = matching.get(at++);
                used.add(recipe.getId());
                proposals.add(proposalOf(day, slot, recipe, intents, cuisines));
            }
        }

        int asked = wanted.days().size() * wanted.slots().size();
        return new Suggestion(
                proposals, asked - proposals.size(), proposals.size() < asked);
    }

    private Proposal proposalOf(LocalDate day, MealSlot slot, Recipe recipe,
                                Set<String> intents, Set<String> cuisines) {
        String because = "LIBRARY";
        if (!cuisines.isEmpty() && recipe.getCuisine() != null
                && cuisines.contains(recipe.getCuisine())) {
            because = "MATCHED_CUISINE";
        } else if (!intents.isEmpty()) {
            because = "MATCHED_INTENT";
        }
        return new Proposal(
                day, slot, recipe.getId(), recipe.getTitle(),
                RecipeService.minutesFor(recipe), recipe.getCuisine(),
                recipe.getTags(), recipe.getPhotoPath() != null, because);
    }

    /** Cumulative, like the library's own filter: two intents mean both. */
    private boolean matchesIntent(Recipe recipe, Set<String> intents) {
        return intents.isEmpty() || recipe.getTags().containsAll(intents);
    }

    /** Alternatives, like the library's: two cuisines mean either. */
    private boolean matchesCuisine(Recipe recipe, Set<String> cuisines) {
        return cuisines.isEmpty()
                || (recipe.getCuisine() != null && cuisines.contains(recipe.getCuisine()));
    }

    /**
     * Best answer first, then the least recently touched.
     *
     * A recipe carrying every intent asked for beats one carrying the minimum,
     * and among equals the one somebody has not cooked in a while beats the one
     * they edited this morning — a suggestion that proposes what you just
     * looked at feels like it was not looking.
     */
    private Comparator<Recipe> bestFirst(Set<String> intents) {
        return Comparator
                .comparingLong((Recipe recipe) -> -matchCount(recipe, intents))
                .thenComparing(Recipe::getUpdatedAt);
    }

    private long matchCount(Recipe recipe, Set<String> intents) {
        return intents.stream().filter(recipe.getTags()::contains).count();
    }

    /** Anything outside the domain is dropped rather than refused. */
    public static Set<String> knownCuisines(Set<String> asked) {
        if (asked == null) {
            return Set.of();
        }
        return asked.stream()
                .map(Cuisine::parseOrNull)
                .filter(java.util.Objects::nonNull)
                .map(Enum::name)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
    }
}
