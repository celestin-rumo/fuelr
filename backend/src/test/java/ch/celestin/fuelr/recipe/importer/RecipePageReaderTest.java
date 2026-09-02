package ch.celestin.fuelr.recipe.importer;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Read against pages captured from the real sites, trimmed to their structured
 * data. Hand-written HTML would only prove the parser reads what I imagined a
 * site does — which is exactly the mistake these fixtures exist to prevent.
 */
class RecipePageReaderTest {

    private final RecipePageReader reader = new RecipePageReader(
            List.of(new JsonLdRecipeParser(), new MicrodataRecipeParser()));

    private RecipePageReader.Reading read(String fixture) throws IOException {
        try (var stream = getClass().getResourceAsStream("/import/" + fixture)) {
            return reader.read(new String(stream.readAllBytes(), StandardCharsets.UTF_8),
                    "https://example.test/");
        }
    }

    @Test
    void readsMarmiton() throws Exception {
        var reading = read("marmiton.html");
        var recipe = reading.recipe();

        assertThat(reading.parser()).isEqualTo("json-ld");
        assertThat(recipe.getTitle()).contains("Pâte à pizza");
        assertThat(recipe.getServings()).isEqualTo(4);
        assertThat(recipe.getTotalMinutes()).isEqualTo(20);
        assertThat(recipe.getSteps()).isNotEmpty();
        assertThat(recipe.getIngredients())
                .anySatisfy(i -> {
                    assertThat(i.name()).contains("farine");
                    assertThat(i.quantity()).isEqualTo(350);
                    assertThat(i.unit()).isEqualTo("g");
                });
    }

    @Test
    void readsBettyBossi() throws Exception {
        var recipe = read("bettybossi.html").recipe();

        assertThat(recipe.getTitle()).isEqualTo("Pâte à pizza");
        assertThat(recipe.getServings()).isEqualTo(4);
        // "2.5 dl d'eau" — a decimal point and a unit the app stores in ml.
        assertThat(recipe.getIngredients())
                .anySatisfy(i -> {
                    assertThat(i.name()).contains("eau");
                    assertThat(i.quantity()).isEqualTo(250);
                    assertThat(i.unit()).isEqualTo("ml");
                });
        // "1.5 c.c. de sel" — the Swiss spelling of a teaspoon.
        assertThat(recipe.getIngredients())
                .anySatisfy(i -> {
                    assertThat(i.name()).contains("sel");
                    assertThat(i.unit()).isEqualTo("c.à.c");
                });
    }

    @Test
    void readsSwissmilkWhichPublishesNoJsonLd() throws Exception {
        var reading = read("swissmilk.html");
        var recipe = reading.recipe();

        assertThat(reading.parser()).isEqualTo("microdata");
        assertThat(recipe.getTitle()).isEqualTo("Pâte à pizza");
        assertThat(recipe.getIngredients()).isNotEmpty();
        // "½ cc de sel" — a vulgar fraction where others write 0.5.
        assertThat(recipe.getIngredients())
                .anySatisfy(i -> {
                    assertThat(i.name()).contains("sel");
                    assertThat(i.quantity()).isEqualTo(0.5);
                    assertThat(i.unit()).isEqualTo("c.à.c");
                });
    }

    @Test
    void swissmilkYieldIsNotACountOfPeople() throws Exception {
        var recipe = read("swissmilk.html").recipe();

        // "env. 600 g de pâte" is a yield, not a number of servings. Reading
        // 600 as six hundred people is the failure this guards against.
        assertThat(recipe.getServings()).isNull();
        assertThat(recipe.getUnverified()).contains("servings");
    }

    @Test
    void readsFoobyWithoutAParserOfItsOwn() throws Exception {
        var reading = read("fooby.html");

        // The point of parsing formats rather than sites: nobody wrote
        // anything for Fooby, and it reads anyway.
        assertThat(reading.parser()).isEqualTo("json-ld");
        assertThat(reading.recipe().getTitle()).contains("Gyozas");
        assertThat(reading.recipe().getIngredients()).isNotEmpty();
    }

    @Test
    void readsWhatCookidooGivesAway_andSaysWhatItWithholds() throws Exception {
        var recipe = read("cookidoo.html").recipe();

        assertThat(recipe.getTitle()).isNotBlank();
        assertThat(recipe.getIngredients()).isNotEmpty();
        // The method is what the subscription pays for: the page publishes no
        // recipeInstructions at all. Importing the rest still beats retyping.
        assertThat(recipe.getSteps()).isEmpty();
    }

    @Test
    void aPageWithNoRecipeIsReadableAsNothing() {
        var reading = reader.read("<html><body><h1>Un blog</h1></body></html>", "https://x.test");

        assertThat(reading.parser()).isNull();
        assertThat(reading.recipe().isEmpty()).isTrue();
    }
}
