package ch.celestin.fuelr.recipe;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The shared table.
 *
 * {@code app/lib/durations.test.ts} runs the same cases against the frontend
 * parser, because the total time on a recipe card and the timers offered on
 * its steps are read from one rule expressed twice. If the two disagree, a
 * card promises 45 minutes over steps that offer no timer — or three timers
 * add up to more than the card ever said. A case added here belongs there too.
 *
 * The expected figure is what one step is worth, so a step stating nothing is
 * three minutes rather than zero.
 */
class RecipeDurationTest {

    @ParameterizedTest(name = "{0} → {1} min")
    @CsvSource(delimiter = '|', value = {
            "Cuire 15 min.                       | 15",
            "Cuire 15min.                        | 15",
            "Laisser reposer 20 minutes.         | 20",
            "20 Minuten ruhen lassen.            | 20",
            "Bake for 20 mins.                   | 20",
            "Mijoter 1 h.                        | 60",
            "Mijoter 1h30.                       | 90",
            "Mijoter 1 h 30.                     | 90",
            "Mijoter 1 h 30 min.                 | 90",
            "Cuire 2 heures.                     | 120",
            "1 Stunde backen.                    | 60",
            "Cuire 10 min, puis dorer 5 min.     | 15",
    })
    void readsWhatTheStepStates(String text, int minutes) {
        assertThat(RecipeService.minutesIn(text.trim())).isEqualTo(minutes);
    }

    /**
     * A step that offers a timer for a number of guests or an oven temperature
     * is worse than a step that offers none, so these have to read as stating
     * nothing at all — which is the three-minute default.
     */
    @ParameterizedTest(name = "{0} states no duration")
    @CsvSource(delimiter = '|', value = {
            "Pour 15 personnes.                  | 3",
            "Préchauffer le four à 180 °C.       | 3",
            "Compter 5 minimum par convive.      | 3",
            "Ajouter 30 g de beurre.             | 3",
            "Rincer les lentilles.               | 3",
    })
    void countsAStepStatingNothingAsThreeMinutes(String text, int minutes) {
        assertThat(RecipeService.minutesIn(text.trim())).isEqualTo(minutes);
    }

    @Test
    void addsUpTheWholeRecipe() {
        var recipe = new Recipe(1L);
        recipe.getSteps().add(new RecipeStep("Rincer les lentilles."));
        recipe.getSteps().add(new RecipeStep("Cuire 15 min."));
        recipe.getSteps().add(new RecipeStep("Reposer 1 h 30."));

        assertThat(RecipeService.minutesFor(recipe)).isEqualTo(3 + 15 + 90);
    }
}
