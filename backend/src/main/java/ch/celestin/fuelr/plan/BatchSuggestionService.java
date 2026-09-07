package ch.celestin.fuelr.plan;

import ch.celestin.fuelr.recipe.Recipe;
import ch.celestin.fuelr.recipe.RecipeIngredient;
import ch.celestin.fuelr.recipe.RecipeService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Dishes chosen so that the work is shareable.
 *
 * The sibling of `WeekSuggestionService`, and the contrast is the whole point.
 * That one fills a week in a *direction*; this one chooses a week so that
 * cooking it once on Sunday is possible at all. Three curries with nothing in
 * common are not a batch; three dishes built on the same roasted vegetables
 * are.
 *
 * **And it is a calculation, not a guess.** Whether two recipes share a base is
 * measurable from lines the library already holds — `SharedBase` says which of
 * them carry work, and `ShoppingService.key` is the only definition of "the
 * same ingredient". So the common case costs nothing, and what a set claims to
 * share is something that was counted rather than asserted.
 */
@Service
public class BatchSuggestionService {

    /**
     * How many sets to offer.
     *
     * Three, because a choice between three is a choice and a list of ten is
     * homework. They are also allowed to overlap — the same recipe can appear
     * in two of them, since these are alternatives rather than a plan.
     */
    private static final int SETS = 3;

    /** One ingredient several dishes of a set are built on. */
    public record Base(String name, String unit, double quantity, int dishes) {
    }

    /** One dish in a set. */
    public record Member(
            Long recipeId,
            String title,
            Integer minutes,
            String cuisine,
            Set<String> tags,
            boolean hasPhoto,
            /** True when somebody had already said this one suits batch cooking. */
            boolean taggedBatch) {
    }

    /**
     * A group of dishes, and what it is a group *because of*.
     *
     * `bases` is not decoration. A proposal that says "these four, trust me"
     * asks for faith; one that says "three of the four are built on the same
     * roasted vegetables" can be checked in a second by the person reading it.
     */
    public record BatchSet(List<Member> members, List<Base> bases, int sharedBy) {
    }

    private final RecipeService recipes;

    public BatchSuggestionService(RecipeService recipes) {
        this.recipes = recipes;
    }

    /**
     * Sets of {@code size} dishes from the cook's own recipes.
     *
     * Grown one dish at a time from a seed: at each step the recipe that adds
     * the most shared work joins, and a set that never finds a base worth the
     * name is dropped rather than offered. Saying "nothing here batches
     * together" is an answer; four unrelated dishes labelled a batch is not.
     */
    public List<BatchSet> fromLibrary(Long userId, int size, java.util.Set<String> intents,
                                  java.util.Set<String> cuisines,
                                  java.util.Set<Long> exclude) {
        java.util.Set<String> wantedIntents = intents == null ? Set.of() : intents;
        java.util.Set<String> wantedCuisines = cuisines == null ? Set.of() : cuisines;
        java.util.Set<Long> skip = exclude == null ? Set.of() : exclude;

        List<Recipe> candidates = recipes.list(userId).stream()
                .filter(recipe -> !skip.contains(recipe.getId()))
                .filter(recipe -> recipe.getStatus() == Recipe.Status.PUBLISHED)
                .filter(recipe -> wantedIntents.isEmpty()
                        || recipe.getTags().containsAll(wantedIntents))
                .filter(recipe -> wantedCuisines.isEmpty()
                        || (recipe.getCuisine() != null
                                && wantedCuisines.contains(recipe.getCuisine())))
                // Somebody already said these suit batch cooking, which is
                // better information than anything computed from a list.
                .sorted(Comparator.comparing((Recipe recipe) ->
                        recipe.getTags().contains("batch") ? 0 : 1))
                .toList();

        if (candidates.size() < size || size < 2) {
            return List.of();
        }

        List<BatchSet> found = new ArrayList<>();
        java.util.Set<String> seen = new LinkedHashSet<>();

        for (Recipe seed : candidates) {
            List<Recipe> group = grow(seed, candidates, size);
            if (group.size() < size) {
                continue;
            }
            BatchSet built = describe(group);
            if (built == null) {
                continue;
            }
            // Two seeds often grow into the same group; offering it twice would
            // read as two choices where there is one.
            String signature = group.stream().map(Recipe::getId).sorted()
                    .map(String::valueOf).reduce("", (a, b) -> a + "-" + b);
            if (seen.add(signature)) {
                found.add(built);
            }
            if (found.size() == SETS) {
                break;
            }
        }
        return found;
    }

    /** Adds, one at a time, whichever recipe brings the most shared work. */
    private List<Recipe> grow(Recipe seed, List<Recipe> candidates, int size) {
        List<Recipe> group = new ArrayList<>();
        group.add(seed);

        while (group.size() < size) {
            Recipe best = null;
            int bestScore = -1;
            for (Recipe candidate : candidates) {
                if (group.contains(candidate)) {
                    continue;
                }
                int score = sharedWith(group, candidate);
                if (score > bestScore) {
                    bestScore = score;
                    best = candidate;
                }
            }
            if (best == null) {
                break;
            }
            group.add(best);
        }
        return group;
    }

    /** How many bases a candidate has in common with a group so far. */
    private int sharedWith(List<Recipe> group, Recipe candidate) {
        java.util.Set<String> mine = basesOf(candidate).keySet();
        int shared = 0;
        for (String key : mine) {
            for (Recipe member : group) {
                if (basesOf(member).containsKey(key)) {
                    shared++;
                    break;
                }
            }
        }
        return shared;
    }

    /**
     * What a group actually shares, or null when the answer is "not enough".
     *
     * The bar is that one base is used by more than half the group. Below that
     * the group is a coincidence — two of five dishes both using rice is not a
     * Sunday afternoon saved, and calling it one is how somebody stops trusting
     * every other suggestion on the screen.
     */
    private BatchSet describe(List<Recipe> group) {
        Map<String, Base> shared = new LinkedHashMap<>();
        for (Recipe recipe : group) {
            basesOf(recipe).forEach((key, line) -> shared.merge(key, line,
                    (current, more) -> new Base(current.name(), current.unit(),
                            current.quantity() + more.quantity(),
                            current.dishes() + more.dishes())));
        }

        List<Base> bases = shared.values().stream()
                .filter(base -> base.dishes() >= 2)
                .sorted(Comparator.comparingInt(Base::dishes).reversed()
                        .thenComparing(Base::name))
                .toList();

        int most = bases.isEmpty() ? 0 : bases.get(0).dishes();
        if (most * 2 <= group.size()) {
            return null;
        }

        List<Member> members = group.stream()
                .map(recipe -> new Member(
                        recipe.getId(), recipe.getTitle(),
                        RecipeService.minutesFor(recipe), recipe.getCuisine(),
                        recipe.getTags(), recipe.getPhotoPath() != null,
                        recipe.getTags().contains("batch")))
                .toList();
        return new BatchSet(members, bases, most);
    }

    /** One recipe's bases, keyed the way the shopping list keys a line. */
    private Map<String, Base> basesOf(Recipe recipe) {
        Map<String, Base> bases = new LinkedHashMap<>();
        for (RecipeIngredient line : recipe.getIngredients()) {
            if (line.getQuantity() == null || line.getUnit() == null) {
                continue;
            }
            double quantity = line.getQuantity().doubleValue();
            if (!SharedBase.carriesWork(line.getUnit(), quantity)) {
                continue;
            }
            // Once per recipe: a recipe listing carrots twice still prepares
            // them once, and counting it twice would inflate every set it is in.
            bases.putIfAbsent(SharedBase.keyOf(line.getName(), line.getUnit()),
                    new Base(line.getName().trim(), line.getUnit(), quantity, 1));
        }
        return bases;
    }
}
