package ch.celestin.fuelr.recipe;

/**
 * Who, besides its author, may read a recipe.
 *
 * The recipe package owns the question and knows nothing about the answer.
 * That is deliberate: the reason to widen access is a shared week plan, which
 * lives in another package entirely, and having recipes reach into planning
 * would put the two packages in a circle. The implementation is supplied from
 * the side that has the fact.
 */
public interface RecipeAudience {

    /**
     * Read access only, and never write. A recipe stays its author's to edit,
     * rename and delete however many people can see it.
     */
    boolean canRead(Long userId, Long recipeId);
}
