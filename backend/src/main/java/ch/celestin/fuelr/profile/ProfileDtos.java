package ch.celestin.fuelr.profile;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public final class ProfileDtos {

    private ProfileDtos() {
    }

    /**
     * Bounds are sanity checks, not medical judgement: they reject a typo like
     * a height of 17 cm without pretending to know who may use the app.
     */
    public record ProfileInput(
            @NotNull @jakarta.validation.constraints.Past java.time.LocalDate birthDate,
            @NotNull Sex sex,
            @Min(120) @Max(230) int heightCm,
            @Min(30) @Max(300) double weightKg,
            @NotNull Activity activity,
            @NotNull Goal goal) {

        /** Arithmetic on the birth date, today. Serialised too, for the screens that show it. */
        @com.fasterxml.jackson.annotation.JsonProperty(value = "age", access = com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY)
        public int age() {
            return birthDate == null ? 0
                    : java.time.Period.between(birthDate, java.time.LocalDate.now()).getYears();
        }

        /** The bounds an age used to carry: a typo, not a medical judgement. */
        @com.fasterxml.jackson.annotation.JsonIgnore
        @jakarta.validation.constraints.AssertTrue(message = "L'âge doit être entre 14 et 100 ans.")
        public boolean isAgePlausible() {
            int age = age();
            return age >= 14 && age <= 100;
        }
    }

    /** Daily targets. Grams are rounded — a gram of precision here is false. */
    public record Targets(int kcal, int proteinG, int carbsG, int fatG) {
    }

    public record ProfileResponse(ProfileInput profile, Targets targets) {
    }
}
