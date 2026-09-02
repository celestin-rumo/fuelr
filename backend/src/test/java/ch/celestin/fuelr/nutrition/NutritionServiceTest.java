package ch.celestin.fuelr.nutrition;

import ch.celestin.fuelr.nutrition.NutritionDtos.IngredientInput;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The reference table is seeded by V4__nutrition.sql, so these assertions also
 * prove the migration ran and the entity maps onto it.
 */
@SpringBootTest
@Testcontainers
class NutritionServiceTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17");

    @Autowired
    NutritionService nutrition;

    @Autowired
    FoodMatcher matcher;

    /**
     * What the reference table says about one food, per 100 g.
     *
     * The tests below check arithmetic and behaviour, not the contents of a
     * published database: hard-coding "lentils are 350 kcal" would turn every
     * upstream correction into a red build for no reason, and those numbers
     * are not ours to assert.
     */
    private double per100(String ingredient) {
        return matcher.match(ingredient).orElseThrow().getKcal();
    }

    /**
     * "Lentilles corail" contains "ail" as well as "lentilles". Which one wins
     * used to depend on the order the rows came back in, and an unrelated
     * migration changed that order — turning 700 kcal of lentils into 300 kcal
     * of garlic with nothing in the diff to suggest it.
     */
    @Test
    void picksTheMostSpecificFoodWhenANameContainsTwo() {
        var lentils = nutrition.compute(
                List.of(new IngredientInput("lentilles corail", 100, "g")), 1);
        var garlic = nutrition.compute(List.of(new IngredientInput("ail", 100, "g")), 1);

        assertThat(lentils.total().kcal()).isEqualTo(per100("lentilles corail"));
        assertThat(garlic.total().kcal()).isEqualTo(per100("ail"));
        // Two different foods, which is the whole point.
        assertThat(lentils.total().kcal()).isNotEqualTo(garlic.total().kcal());
        assertThat(lentils.containsEstimates()).isFalse();
    }

    @Test
    void computesGramsAgainstThePer100Reference() {
        // Whatever the table says lentils are, 200 g is twice 100 g.
        var hundred = nutrition.compute(
                List.of(new IngredientInput("lentilles corail", 100, "g")), 1);
        var twoHundred = nutrition.compute(
                List.of(new IngredientInput("lentilles corail", 200, "g")), 1);

        assertThat(twoHundred.total().kcal()).isEqualTo(hundred.total().kcal() * 2);
        assertThat(twoHundred.total().proteinG()).isEqualTo(hundred.total().proteinG() * 2);
        assertThat(twoHundred.total().carbsG()).isEqualTo(hundred.total().carbsG() * 2);
        assertThat(twoHundred.containsEstimates()).isFalse();
    }

    @Test
    void dividesByTheNumberOfServings() {
        var result = nutrition.compute(
                List.of(new IngredientInput("riz", 400, "g")), 4);

        assertThat(result.total().kcal()).isEqualTo(per100("riz") * 4);
        assertThat(result.perServing().kcal()).isEqualTo(per100("riz"));
        assertThat(result.servings()).isEqualTo(4);
    }

    @Test
    void flagsAnIngredientItCannotRecognise() {
        // A brand nobody publishes composition for. The fallback exists for
        // exactly this, and says so rather than pretending to know.
        var result = nutrition.compute(
                List.of(new IngredientInput("Zoubidou 3000", 100, "g")), 1);

        assertThat(result.containsEstimates()).isTrue();
        assertThat(result.ingredients()).singleElement()
                .satisfies(line -> {
                    assertThat(line.guessed()).isTrue();
                    assertThat(line.kcal()).isEqualTo(60.0);
                });
    }

    @Test
    void convertsTheNonWeightUnits() {
        assertThat(NutritionService.factorFor("g", 250)).isEqualTo(2.5);
        assertThat(NutritionService.factorFor("ml", 100)).isEqualTo(1.0);
        assertThat(NutritionService.factorFor("pcs", 2)).isEqualTo(2.4);
        assertThat(NutritionService.factorFor("c.à.s", 2)).isEqualTo(0.3);
        assertThat(NutritionService.factorFor("c.à.c", 3)).isCloseTo(0.15, org.assertj.core.data.Offset.offset(1e-9));
    }

    @Test
    void rejectsAnUnknownUnitRatherThanGuessing() {
        assertThatThrownBy(() -> NutritionService.factorFor("poignée", 1))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsZeroServings() {
        assertThatThrownBy(() -> nutrition.compute(
                List.of(new IngredientInput("riz", 100, "g")), 0))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void addsUpSeveralIngredients() {
        var result = nutrition.compute(List.of(
                new IngredientInput("poulet", 300, "g"),
                new IngredientInput("riz", 200, "g"),
                new IngredientInput("huile d\'olive", 1, "c.à.s")), 2);

        double expected = per100("poulet") * 3 + per100("riz") * 2
                + per100("huile d\'olive") * 0.15;
        assertThat(result.total().kcal()).isCloseTo(expected, within(0.2));
        assertThat(result.perServing().kcal())
                .isCloseTo(expected / 2, within(0.2));
        assertThat(result.ingredients()).hasSize(3);
        assertThat(result.containsEstimates()).isFalse();
    }

    @Test
    void theDetailCarriesTheMacrosAndTheMicronutrientsTheSourceMeasured() {
        var detail = nutrition.detail(List.of(
                new IngredientInput("épinards", 200, "g"),
                new IngredientInput("saumon", 150, "g")), 2);

        assertThat(detail.perServing().kcal()).isGreaterThan(0);
        assertThat(detail.perServing().fibreG()).isGreaterThan(0);
        assertThat(detail.micronutrients())
                .extracting(NutritionDtos.NutrientAmount::code)
                .contains("iron", "calcium", "vitamin_c");
        // Per serving, so two people eating this get half of it each.
        assertThat(detail.total().kcal()).isEqualTo(detail.perServing().kcal() * 2);
    }

    @Test
    void aGuessedIngredientContributesNoMicronutrients() {
        var detail = nutrition.detail(
                List.of(new IngredientInput("Zoubidou 3000", 100, "g")), 1);

        assertThat(detail.containsEstimates()).isTrue();
        // The fallback has four numbers and no vitamins; inventing them is the
        // one thing this screen must not do.
        assertThat(detail.micronutrients()).isEmpty();
        assertThat(detail.perServing().kcal()).isEqualTo(60.0);
    }
}
