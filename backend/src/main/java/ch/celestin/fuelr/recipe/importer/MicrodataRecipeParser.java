package ch.celestin.fuelr.recipe.importer;

import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * schema.org/Recipe expressed as microdata in the HTML itself — older, still
 * widespread, and what Swissmilk publishes. Tried after JSON-LD because a page
 * carrying both states it more reliably in JSON.
 */
@Component
@Order(200)
public class MicrodataRecipeParser implements RecipePageParser {

    private static final String SCOPE = "[itemtype~=(?i)https?://schema\\.org/Recipe]";

    @Override
    public String name() {
        return "microdata";
    }

    @Override
    public boolean supports(Document document) {
        return document.selectFirst(SCOPE) != null;
    }

    @Override
    public ParsedRecipe parse(Document document) {
        Element scope = document.selectFirst(SCOPE);
        ParsedRecipe recipe = new ParsedRecipe();
        if (scope == null) {
            return recipe;
        }

        recipe.setTitle(prop(scope, "name"));
        recipe.setDescription(prop(scope, "description"));
        RecipeFields.readServings(recipe, prop(scope, "recipeYield"));
        recipe.setTotalMinutes(RecipeFields.firstDuration(
                prop(scope, "totalTime"), prop(scope, "cookTime"), prop(scope, "prepTime")));

        for (Element element : scope.select("[itemprop=recipeIngredient], [itemprop=ingredients]")) {
            RecipeFields.addIngredient(recipe, element.text());
        }
        for (Element element : scope.select("[itemprop=recipeInstructions]")) {
            RecipeFields.addProse(recipe, element.text());
        }
        return recipe;
    }

    /** Durations live in `content`; everything else is the element's text. */
    private String prop(Element scope, String name) {
        Element element = scope.selectFirst("[itemprop=" + name + "]");
        if (element == null) {
            return null;
        }
        String content = element.attr("content");
        return content.isBlank() ? element.text() : content;
    }
}
