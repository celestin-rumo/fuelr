package ch.celestin.fuelr.profile;

import ch.celestin.fuelr.profile.ProfileDtos.ProfileInput;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;

@Entity
@Table(name = "profiles")
public class Profile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    @Column(nullable = false)
    private int age;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Sex sex;

    @Column(name = "height_cm", nullable = false)
    private int heightCm;

    /**
     * BigDecimal against NUMERIC(5,1), like recipe quantities. A double here
     * would fail schema validation, and would store 70.1 as something that is
     * not quite 70.1.
     */
    @Column(name = "weight_kg", nullable = false)
    private BigDecimal weightKg;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Activity activity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Goal goal;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    protected Profile() {
    }

    public Profile(Long userId, ProfileInput input) {
        this.userId = userId;
        apply(input);
    }

    public final void apply(ProfileInput input) {
        this.age = input.age();
        this.sex = input.sex();
        this.heightCm = input.heightCm();
        this.weightKg = BigDecimal.valueOf(input.weightKg()).setScale(1, RoundingMode.HALF_UP);
        this.activity = input.activity();
        this.goal = input.goal();
    }

    public ProfileInput toInput() {
        return new ProfileInput(age, sex, heightCm, weightKg.doubleValue(), activity, goal);
    }

    @PreUpdate
    void touch() {
        this.updatedAt = Instant.now();
    }
}
