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
        Found found = findRecipe(document);
        return found == null ? new ParsedRecipe() : read(found, document.baseUri());
    }

    /**
     * The recipe, and the block it was found in.
     *
     * The block matters because schema.org lets a value be a reference: the
     * recipe's `image` is often `{"@id": "…#primaryimage"}`, and the
     * ImageObject it names is a sibling in the same `@graph`.
     */
    private record Found(JsonNode recipe, JsonNode block) {
    }

    private Found findRecipe(Document document) {
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
                return new Found(found, root);
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

    private ParsedRecipe read(Found found, String baseUri) {
        JsonNode node = found.recipe();
        ParsedRecipe recipe = new ParsedRecipe();
        recipe.setTitle(text(node.get("name")));
        recipe.setDescription(text(node.get("description")));
        recipe.setImageUrl(RecipeFields.absolute(image(found), baseUri));

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

    /**
     * `image` is a string on one site, an array on the next, an ImageObject on
     * a third and a bare `@id` pointing at one on a fourth. All four are in
     * the fixtures, so all four are read here rather than in four callers.
     */
    private String image(Found found) {
        String url = urlOf(found.recipe().get("image"), found.block());
        // A thumbnail is a poor photo and a good last resort: it is what
        // Marmiton publishes beside the reference it also publishes.
        return url != null ? url : text(found.recipe().get("thumbnailUrl"));
    }

    private String urlOf(JsonNode node, JsonNode block) {
        if (node == null || node.isNull()) {
            return null;
        }
        if (node.isTextual()) {
            return blank(node.asText()) ? null : node.asText();
        }
        if (node.isArray()) {
            for (JsonNode entry : node) {
                String url = urlOf(entry, block);
                if (url != null) {
                    return url;
                }
            }
            return null;
        }
        if (!node.isObject()) {
            return null;
        }
        for (String field : new String[] {"url", "contentUrl"}) {
            String url = text(node.get(field));
            if (!blank(url)) {
                return url;
            }
        }
        // A reference: the object with that identity is elsewhere in the block.
        String id = text(node.get("@id"));
        return blank(id) ? null : urlOf(byId(block, id), null);
    }

    /** Finds the node carrying an `@id`, without following a reference twice. */
    private JsonNode byId(JsonNode block, String id) {
        if (block == null) {
            return null;
        }
        Deque<JsonNode> stack = new ArrayDeque<>();
        stack.push(block);
        while (!stack.isEmpty()) {
            JsonNode node = stack.pop();
            if (node.isArray()) {
                node.forEach(stack::push);
                continue;
            }
            if (!node.isObject()) {
                continue;
            }
            // A node that is only an `@id` is the reference, not the target.
            if (id.equals(text(node.get("@id"))) && node.size() > 1) {
                return node;
            }
            node.forEach(stack::push);
        }
        return null;
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
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
