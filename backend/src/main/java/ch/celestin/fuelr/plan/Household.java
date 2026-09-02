package ch.celestin.fuelr.plan;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * How many people the plan cooks for. That is all it holds today.
 *
 * It exists as a row of its own rather than a column on the profile because a
 * profile is optional — someone can plan a week without ever having filled in
 * their age and weight — and because this is where the Famille story attaches
 * its members.
 */
@Entity
@Table(name = "households")
public class Household {

    /** What a household is worth before anyone says otherwise. */
    public static final int DEFAULT_SIZE = 2;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "owner_user_id", nullable = false, unique = true)
    private Long ownerUserId;

    @Column(nullable = false)
    private int size = DEFAULT_SIZE;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    protected Household() {
    }

    public Household(Long ownerUserId) {
        this.ownerUserId = ownerUserId;
    }

    @PreUpdate
    void touch() {
        this.updatedAt = Instant.now();
    }

    public int getSize() {
        return size;
    }

    public void setSize(int size) {
        this.size = size;
    }
}
