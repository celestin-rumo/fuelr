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
 * A household: the thing a week plan belongs to.
 *
 * Everyone owns exactly one, created the first time they plan anything, and
 * {@code size} is how many people it cooks for — which is not the same as how
 * many accounts are in it, because children eat without having an account.
 * {@link HouseholdMember} is what puts other accounts inside one, and that is
 * the part the Famille plan pays for.
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

    public Long getId() {
        return id;
    }

    public Long getOwnerUserId() {
        return ownerUserId;
    }

    public int getSize() {
        return size;
    }

    public void setSize(int size) {
        this.size = size;
    }
}
