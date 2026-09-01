package ch.celestin.fuelr.profile;

import ch.celestin.fuelr.profile.ProfileDtos.ProfileInput;
import ch.celestin.fuelr.profile.ProfileDtos.Targets;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class NutritionTargetServiceTest {

    private final NutritionTargetService service = new NutritionTargetService();

    private static ProfileInput profile(Sex sex, Activity activity, Goal goal) {
        return new ProfileInput(30, sex, 175, 70, activity, goal);
    }

    @Test
    void matchesMifflinStJeorForAMan() {
        // 10×70 + 6.25×175 − 5×30 + 5 = 1648.75
        assertThat(NutritionTargetService.basalRate(profile(Sex.MALE, Activity.SEDENTARY, Goal.MAINTAIN)))
                .isCloseTo(1648.75, within(0.01));
    }

    @Test
    void matchesMifflinStJeorForAWoman() {
        // Same body, the formula's other constant: 1648.75 − 5 − 161 = 1482.75
        assertThat(NutritionTargetService.basalRate(profile(Sex.FEMALE, Activity.SEDENTARY, Goal.MAINTAIN)))
                .isCloseTo(1482.75, within(0.01));
    }

    @Test
    void movingMore_meansEatingMore() {
        int sedentary = service.compute(profile(Sex.MALE, Activity.SEDENTARY, Goal.MAINTAIN)).kcal();
        int active = service.compute(profile(Sex.MALE, Activity.VERY_ACTIVE, Goal.MAINTAIN)).kcal();

        assertThat(active).isGreaterThan(sedentary);
        // 1.9 / 1.2 — the factors, not a number pulled from the output.
        assertThat((double) active / sedentary).isCloseTo(1.9 / 1.2, within(0.01));
    }

    @Test
    void theGoalShiftsTheMaintenanceFigureInBothDirections() {
        int maintain = service.compute(profile(Sex.MALE, Activity.MODERATE, Goal.MAINTAIN)).kcal();
        int lose = service.compute(profile(Sex.MALE, Activity.MODERATE, Goal.LOSE)).kcal();
        int gain = service.compute(profile(Sex.MALE, Activity.MODERATE, Goal.GAIN)).kcal();

        assertThat(lose).isLessThan(maintain);
        assertThat(gain).isGreaterThan(maintain);
        assertThat(lose).isCloseTo((int) (maintain * 0.8), within(2));
        assertThat(gain).isCloseTo((int) (maintain * 1.15), within(2));
    }

    @Test
    void theMacrosAddBackUpToTheEnergyShownBesideThem() {
        for (Goal goal : Goal.values()) {
            Targets targets = service.compute(profile(Sex.FEMALE, Activity.LIGHT, goal));
            int fromMacros = targets.proteinG() * 4 + targets.carbsG() * 4 + targets.fatG() * 9;

            // Rounding to whole grams is the only slack allowed: a person
            // reading three numbers must not find they sum to a fourth.
            assertThat(fromMacros).isCloseTo(targets.kcal(), within(6));
        }
    }

    @Test
    void proteinFollowsBodyWeight_andRisesWhenLosing() {
        Targets maintain = service.compute(profile(Sex.FEMALE, Activity.LIGHT, Goal.MAINTAIN));
        Targets lose = service.compute(profile(Sex.FEMALE, Activity.LIGHT, Goal.LOSE));

        assertThat(maintain.proteinG()).isEqualTo((int) Math.round(70 * 1.8));
        assertThat(lose.proteinG()).isGreaterThan(maintain.proteinG());
    }

    @Test
    void aDeficitNeverProducesATargetBelowTheFloor() {
        // Small, sedentary, and losing: the arithmetic alone would go under.
        ProfileInput small = new ProfileInput(
                75, Sex.FEMALE, 145, 40, Activity.SEDENTARY, Goal.LOSE);

        assertThat(service.compute(small).kcal())
                .isEqualTo(NutritionTargetService.MINIMUM_KCAL);
    }
}
