package ch.celestin.fuelr.log;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * What somebody is aiming for, when they said so.
 *
 * No row means the profile's computed figures stand. That distinction matters:
 * a target nobody chose is a suggestion, and the screen says so rather than
 * presenting arithmetic as a decision the person made.
 */
@Entity
@Table(name = "nutrition_targets")
public class NutritionTarget {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Column(nullable = false)
    private int kcal;

    @Column(name = "protein_g", nullable = false)
    private int proteinG;

    @Column(name = "carbs_g", nullable = false)
    private int carbsG;

    @Column(name = "fat_g", nullable = false)
    private int fatG;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    protected NutritionTarget() {
    }

    public NutritionTarget(Long userId, int kcal, int protein, int carbs, int fat) {
        this.userId = userId;
        set(kcal, protein, carbs, fat);
    }

    @PreUpdate
    void touch() {
        this.updatedAt = Instant.now();
    }

    public final void set(int kcal, int protein, int carbs, int fat) {
        this.kcal = kcal;
        this.proteinG = protein;
        this.carbsG = carbs;
        this.fatG = fat;
    }

    public int getKcal() {
        return kcal;
    }

    public int getProteinG() {
        return proteinG;
    }

    public int getCarbsG() {
        return carbsG;
    }

    public int getFatG() {
        return fatG;
    }
}
