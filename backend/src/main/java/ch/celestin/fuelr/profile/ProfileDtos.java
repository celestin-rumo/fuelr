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
            @Min(14) @Max(100) int age,
            @NotNull Sex sex,
            @Min(120) @Max(230) int heightCm,
            @Min(30) @Max(300) double weightKg,
            @NotNull Activity activity,
            @NotNull Goal goal) {
    }

    /** Daily targets. Grams are rounded — a gram of precision here is false. */
    public record Targets(int kcal, int proteinG, int carbsG, int fatG) {
    }

    public record ProfileResponse(ProfileInput profile, Targets targets) {
    }
}
