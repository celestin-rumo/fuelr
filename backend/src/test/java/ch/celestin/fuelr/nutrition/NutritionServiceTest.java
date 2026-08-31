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

    @Test
    void computesGramsAgainstThePer100Reference() {
        // Lentilles: 350 kcal / 24 p / 60 c / 1 f per 100 g, so 200 g doubles it.
        var result = nutrition.compute(
                List.of(new IngredientInput("lentilles corail", 200, "g")), 1);

        assertThat(result.total().kcal()).isEqualTo(700.0);
        assertThat(result.total().proteinG()).isEqualTo(48.0);
        assertThat(result.total().carbsG()).isEqualTo(120.0);
        assertThat(result.total().fatG()).isEqualTo(2.0);
        assertThat(result.containsEstimates()).isFalse();
    }

    @Test
    void dividesByTheNumberOfServings() {
        var result = nutrition.compute(
                List.of(new IngredientInput("riz", 400, "g")), 4);

        assertThat(result.total().kcal()).isEqualTo(1400.0);
        assertThat(result.perServing().kcal()).isEqualTo(350.0);
        assertThat(result.servings()).isEqualTo(4);
    }

    @Test
    void flagsAnIngredientItCannotRecognise() {
        var result = nutrition.compute(
                List.of(new IngredientInput("racine de yuzu confite", 100, "g")), 1);

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
                new IngredientInput("huile d'olive", 1, "c.à.s")), 2);

        // 495 + 700 + 132 kcal
        assertThat(result.total().kcal()).isEqualTo(1327.0);
        assertThat(result.perServing().kcal()).isEqualTo(663.5);
        assertThat(result.ingredients()).hasSize(3);
        assertThat(result.containsEstimates()).isFalse();
    }
}
