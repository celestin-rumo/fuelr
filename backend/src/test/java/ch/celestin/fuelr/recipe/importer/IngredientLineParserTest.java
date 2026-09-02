package ch.celestin.fuelr.recipe.importer;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Every case here came off a real page. schema.org gives ingredients as free
 * text, so this is guesswork — the contract is that it never hides the fact.
 */
class IngredientLineParserTest {

    @Test
    void readsAWeight() {
        var parsed = IngredientLineParser.parse("400 g de farine");

        assertThat(parsed.name()).isEqualTo("farine");
        assertThat(parsed.quantity()).isEqualTo(400);
        assertThat(parsed.unit()).isEqualTo("g");
        assertThat(parsed.needsReview()).isFalse();
    }

    @Test
    void convertsToTheUnitsTheApplicationWeighsIn() {
        assertThat(IngredientLineParser.parse("2.5 dl d'eau").quantity()).isEqualTo(250);
        assertThat(IngredientLineParser.parse("2.5 dl d'eau").unit()).isEqualTo("ml");
        assertThat(IngredientLineParser.parse("1 kg de pommes").quantity()).isEqualTo(1000);
        assertThat(IngredientLineParser.parse("1 kg de pommes").unit()).isEqualTo("g");
    }

    @Test
    void readsFractionsAndDecimalsAlike() {
        assertThat(IngredientLineParser.parse("½ cc de sel").quantity()).isEqualTo(0.5);
        assertThat(IngredientLineParser.parse("1.5 c.c. de sel").quantity()).isEqualTo(1.5);
        assertThat(IngredientLineParser.parse("1,5 cs d'huile").quantity()).isEqualTo(1.5);
        assertThat(IngredientLineParser.parse("1/2 citron").quantity()).isEqualTo(0.5);
    }

    @Test
    void spelledOutSpoonsBeatTheirAbbreviations() {
        // "cuillères à soupe" must not be read as "c" and then "uillères…".
        var parsed = IngredientLineParser.parse("3 cuillères à soupe d'huile d'olive");

        assertThat(parsed.unit()).isEqualTo("c.à.s");
        assertThat(parsed.quantity()).isEqualTo(3);
        assertThat(parsed.name()).isEqualTo("huile d'olive");
    }

    @Test
    void aWordStartingWithAUnitLetterIsNotAUnit() {
        // "gousse" begins with g, and is not grams.
        var parsed = IngredientLineParser.parse("2 gousses d'ail");

        assertThat(parsed.unit()).isEqualTo("pcs");
        assertThat(parsed.name()).isEqualTo("gousses d'ail");
    }

    @Test
    void countsWithoutAUnitAreFlagged() {
        // "2 œufs" is right as far as it goes, but the unit was assumed.
        var parsed = IngredientLineParser.parse("2 œufs");

        assertThat(parsed.quantity()).isEqualTo(2);
        assertThat(parsed.unit()).isEqualTo("pcs");
        assertThat(parsed.needsReview()).isTrue();
    }

    @Test
    void aHeadingKeepsItsTextAndAsksToBeLookedAt() {
        // Swissmilk mixes this into its ingredient list.
        var parsed = IngredientLineParser.parse("Pour une plaque de four ou 4 disques de 20 cm");

        assertThat(parsed.name()).startsWith("Pour une plaque");
        assertThat(parsed.needsReview()).isTrue();
    }

    @Test
    void malformedSourceDataIsKeptRatherThanGuessedAt() {
        // Fooby really publishes "1 de cc de gingembre".
        var parsed = IngredientLineParser.parse("1 de cc de gingembre");

        assertThat(parsed.needsReview()).isTrue();
        assertThat(parsed.name()).contains("gingembre");
    }

    @Test
    void ignoresEmptiness() {
        assertThat(IngredientLineParser.parse("   ")).isNull();
        assertThat(IngredientLineParser.parse(null)).isNull();
    }
}
