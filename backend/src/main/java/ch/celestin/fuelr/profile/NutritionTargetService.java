package ch.celestin.fuelr.profile;

import ch.celestin.fuelr.profile.ProfileDtos.ProfileInput;
import ch.celestin.fuelr.profile.ProfileDtos.Targets;
import org.springframework.stereotype.Service;

/**
 * What a person needs in a day.
 *
 * Distinct from {@code NutritionService}, which says what is in a dish. The
 * two answer different questions and share nothing but the units — merging
 * them would produce a class that computes "nutrition" and means two things.
 *
 * Like its neighbour, it lives on the server so the web app and the future
 * native app cannot drift apart on the arithmetic.
 */
@Service
public class NutritionTargetService {

    /**
     * Share of energy from fat. The rest, after protein is taken out, goes to
     * carbohydrate — so this is the one macro set as a proportion.
     */
    static final double FAT_SHARE = 0.28;

    private static final int KCAL_PER_G_PROTEIN = 4;
    private static final int KCAL_PER_G_CARBS = 4;
    private static final int KCAL_PER_G_FAT = 9;

    /**
     * A floor, not a recommendation. It stops the arithmetic producing a
     * target no one should eat to, when a large deficit meets a small body.
     */
    static final int MINIMUM_KCAL = 1200;

    /** Mifflin-St Jeor: the resting rate, before any movement. */
    static double basalRate(ProfileInput profile) {
        double base = 10 * profile.weightKg()
                + 6.25 * profile.heightCm()
                - 5 * profile.age();
        return profile.sex() == Sex.MALE ? base + 5 : base - 161;
    }

    public Targets compute(ProfileInput profile) {
        double maintenance = basalRate(profile) * profile.activity().factor();
        double energy = maintenance * (1 + profile.goal().energyShift());
        int kcal = Math.max(MINIMUM_KCAL, (int) Math.round(energy));

        int proteinG = (int) Math.round(profile.weightKg() * profile.goal().proteinPerKg());
        int fatG = (int) Math.round(kcal * FAT_SHARE / KCAL_PER_G_FAT);

        // Carbohydrate takes what is left, so the three macros always add back
        // up to the energy figure shown next to them.
        int remaining = kcal - proteinG * KCAL_PER_G_PROTEIN - fatG * KCAL_PER_G_FAT;
        int carbsG = Math.max(0, Math.round((float) remaining / KCAL_PER_G_CARBS));

        return new Targets(kcal, proteinG, carbsG, fatG);
    }
}
