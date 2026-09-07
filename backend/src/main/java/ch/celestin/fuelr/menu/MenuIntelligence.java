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

    String name();

    /** False while no provider is wired; the library still answers. */
    boolean available();

    /**
     * @param have    what the cook said they have, in their own words
     * @param wanted  how many ideas are still needed
     * @param already titles the library already proposed, not to be repeated
     */
    Ideas suggest(String have, int wanted, List<String> already);

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
                     int wanted, List<String> already, String note);
}
