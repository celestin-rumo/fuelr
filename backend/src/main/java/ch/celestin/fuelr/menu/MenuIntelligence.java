package ch.celestin.fuelr.menu;

import ch.celestin.fuelr.recipe.importer.RecipeIntelligence;

import java.util.List;

/**
 * Ideas for what to cook, from what somebody has.
 *
 * A separate interface from the one that reads recipes, because it is a
 * separate job: that one transcribes something that exists, this one proposes
 * something that does not. Sharing an interface would have meant one of the
 * two carrying a method it never implements.
 *
 * What it returns is a proposal and is treated as one everywhere: an idea
 * becomes a draft the cook corrects, never a recipe in the library, and every
 * quantity it invents arrives flagged.
 */
public interface MenuIntelligence {

    /** The ideas, and what they cost. */
    record Ideas(List<MenuDtos.Suggestion> suggestions, RecipeIntelligence.Usage usage) {
    }

    /**
     * Told as each dish is written, so a screen can count along.
     *
     * A model writes fourteen dinners in about two minutes, and a spinner
     * over two minutes reads as a hang. The title of a dish closes long
     * before its ingredients and steps do, so "plat 6 sur 14 — Dahl de
     * lentilles" can be said while the dahl is still being written. It is a
     * fact about the stream, never a promise: what the screen is finally
     * handed is still the whole answer, read and checked as before.
     */
    @FunctionalInterface
    interface Progress {
        Progress NONE = (index, of, title) -> { };

        /**
         * @param index the dish whose title just closed, counted from one
         * @param of    how many were asked for
         * @param title what it is called
         */
        void dish(int index, int of, String title);

        /**
         * A dish written to the end — title, ingredients, steps — while the
         * model goes on with the next. What a screen shows as a row the
         * moment it exists, rather than a count. The object is whatever the
         * caller made of the suggestion: a placed proposal, a set member.
         *
         * @param index the dish, counted from one
         * @param of    how many were asked for
         * @param dish  the dish, as the caller shapes it
         */
        default void completed(int index, int of, Object dish) {
        }
    }

    String name();

    /** False while no provider is wired; the library still answers. */
    boolean available();

    /**
     * @param have    what the cook said they have, in their own words
     * @param wanted  how many ideas are still needed
     * @param already titles the library already proposed, not to be repeated
     */
    Ideas suggest(String have, int wanted, List<String> already,
                  ch.celestin.fuelr.preferences.Constraints constraints);

    /**
     * The same job entered from the other end: not from what is in the bag,
     * but from what somebody wants.
     *
     * A second method rather than passing "light, Italian" as the bag — the
     * prompt behind `suggest` reads its argument as a list of ingredients, and
     * handing it an intention there would ask for a dish made of adjectives.
     *
     * @param intents  closed-domain tags: vegetarian, quick, protein…
     * @param cuisines closed-domain cuisines; several mean either
     * @param wanted   how many dishes the library could not supply
     * @param already  titles already proposed, not to be repeated
     */
    Ideas suggestFor(java.util.Set<String> intents, java.util.Set<String> cuisines,
                     int wanted, List<String> already, String note,
                     ch.celestin.fuelr.preferences.Constraints constraints);

    /**
     * Dishes meant to be cooked in one session.
     *
     * A third method, and again because the prompt is a different question:
     * `suggestFor` asks for dishes that each answer a wish, and any four of
     * them may share nothing at all. This one asks for a *set* — dishes built
     * on the same base, so the peeling and the roasting happen once.
     *
     * What comes back is still only a list of dishes with their ingredients.
     * What the set actually shares is computed from those lines by
     * `SharedBase`, never taken from anything the model says about itself: a
     * claim of sharing is exactly the kind of thing that is cheap to assert
     * and expensive to be wrong about.
     *
     * @param intents  closed-domain tags: vegetarian, quick, protein…
     * @param cuisines closed-domain cuisines; several mean either
     * @param wanted   how many dishes the set should hold
     */
    Ideas suggestBatch(java.util.Set<String> intents, java.util.Set<String> cuisines,
                       int wanted, ch.celestin.fuelr.preferences.Constraints constraints);

    // --- the same three, counted along --------------------------------------
    // Defaults, so a provider that answers in one piece — and every stand-in
    // in the tests — implements nothing new and is simply never heard from
    // until the end.

    default Ideas suggest(String have, int wanted, List<String> already,
                          ch.celestin.fuelr.preferences.Constraints constraints, Progress progress) {
        return suggest(have, wanted, already, constraints);
    }

    default Ideas suggestFor(java.util.Set<String> intents, java.util.Set<String> cuisines,
                             int wanted, List<String> already, String note,
                             ch.celestin.fuelr.preferences.Constraints constraints, Progress progress) {
        return suggestFor(intents, cuisines, wanted, already, note, constraints);
    }

    default Ideas suggestBatch(java.util.Set<String> intents, java.util.Set<String> cuisines,
                               int wanted, ch.celestin.fuelr.preferences.Constraints constraints,
                               Progress progress) {
        return suggestBatch(intents, cuisines, wanted, constraints);
    }
}
