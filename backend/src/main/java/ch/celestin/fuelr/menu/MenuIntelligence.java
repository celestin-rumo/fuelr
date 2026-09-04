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
}
