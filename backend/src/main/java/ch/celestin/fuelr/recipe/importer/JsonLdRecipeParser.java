package ch.celestin.fuelr.recipe.importer;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.Deque;

/**
 * schema.org/Recipe published as JSON-LD — by far the most common way a
 * recipe site says what it is holding. Marmiton, Betty Bossi and Fooby all use
 * it, and so does most of the cooking web: this is the parser that makes the
 * feature work on sites nobody thought to test.
 */
@Component
@Order(100)
public class JsonLdRecipeParser implements RecipePageParser {

    private static final ObjectMapper JSON = new ObjectMapper();

    @Override
    public String name() {
        return "json-ld";
    }

    @Override
    public boolean supports(Document document) {
        return findRecipe(document) != null;
    }

    @Override
    public ParsedRecipe parse(Document document) {
        JsonNode node = findRecipe(document);
        return node == null ? new ParsedRecipe() : read(node);
    }

    private JsonNode findRecipe(Document document) {
        for (Element script : document.select("script[type=application/ld+json]")) {
            JsonNode root;
            try {
                root = JSON.readTree(script.data());
            } catch (Exception e) {
                // Sites commonly ship several blocks and only one has to be
                // valid; a malformed neighbour is not a reason to give up.
                continue;
            }
            JsonNode found = walk(root);
            if (found != null) {
                return found;
            }
        }
        return null;
    }

    /** Recipes hide inside arrays and inside `@graph`; walk rather than guess. */
    private JsonNode walk(JsonNode root) {
        Deque<JsonNode> stack = new ArrayDeque<>();
        stack.push(root);
        while (!stack.isEmpty()) {
            JsonNode node = stack.pop();
            if (node.isArray()) {
                node.forEach(stack::push);
                continue;
            }
            if (!node.isObject()) {
                continue;
            }
            if (node.has("@graph")) {
                stack.push(node.get("@graph"));
            }
            if (isType(node, "Recipe")) {
                return node;
            }
        }
        return null;
    }

    static boolean isType(JsonNode node, String wanted) {
        JsonNode type = node.get("@type");
        if (type == null) {
            return false;
        }
        if (type.isArray()) {
            for (JsonNode one : type) {
                if (wanted.equals(one.asText())) {
                    return true;
                }
            }
            return false;
        }
        return wanted.equals(type.asText());
    }

    private ParsedRecipe read(JsonNode node) {
        ParsedRecipe recipe = new ParsedRecipe();
        recipe.setTitle(text(node.get("name")));
        recipe.setDescription(text(node.get("description")));

        RecipeFields.readServings(recipe, text(node.get("recipeYield")));
        recipe.setTotalMinutes(RecipeFields.firstDuration(
                text(node.get("totalTime")), text(node.get("cookTime")), text(node.get("prepTime"))));

        JsonNode ingredients = node.has("recipeIngredient")
                ? node.get("recipeIngredient") : node.get("ingredients");
        if (ingredients != null && ingredients.isArray()) {
            ingredients.forEach(line -> RecipeFields.addIngredient(recipe, line.asText()));
        }

        collectSteps(recipe, node.get("recipeInstructions"));
        splitIfItIsOneLongStep(recipe);
        return recipe;
    }

    /**
     * Instructions arrive as a string, a list of strings, a list of HowToStep,
     * or HowToSection wrapping more of the same. All four are in the wild.
     */
    private void collectSteps(ParsedRecipe recipe, JsonNode instructions) {
        if (instructions == null || instructions.isNull()) {
            return;
        }
        if (instructions.isTextual()) {
            RecipeFields.addProse(recipe, instructions.asText());
            return;
        }
        if (!instructions.isArray()) {
            return;
        }
        for (JsonNode entry : instructions) {
            if (entry.isTextual()) {
                RecipeFields.addStep(recipe, entry.asText());
            } else if (isType(entry, "HowToSection")) {
                collectSteps(recipe, entry.get("itemListElement"));
            } else {
                RecipeFields.addStep(recipe, text(entry.get("text")));
            }
        }
    }

    /**
     * A source that numbers its steps is believed — Marmiton's eight are eight.
     * But a single "Étape 1" holding the whole method, as Betty Bossi
     * publishes, is not a step list: it is a paragraph that happens to be in
     * one. Splitting it is a guess, so {@code addProse} flags it as one.
     */
    private void splitIfItIsOneLongStep(ParsedRecipe recipe) {
        if (recipe.getSteps().size() != 1) {
            return;
        }
        String only = recipe.getSteps().get(0);
        recipe.getSteps().clear();
        RecipeFields.addProse(recipe, only);
    }

    private String text(JsonNode node) {
        if (node == null || node.isNull()) {
            return null;
        }
        if (node.isArray()) {
            return node.isEmpty() ? null : node.get(0).asText();
        }
        return node.asText();
    }
}
