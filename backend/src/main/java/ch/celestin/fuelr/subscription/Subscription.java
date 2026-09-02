package ch.celestin.fuelr.subscription;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * What one account is currently paying for.
 *
 * A cancelled or lapsed row is kept rather than deleted: it is the record that
 * the account was once entitled, and the promise on the pricing page is that
 * cancelling loses nothing. {@link #tierNow()} is what decides access, and it
 * answers FREE without anything having to run at midnight.
 */
@Entity
@Table(name = "subscriptions")
public class Subscription {

    public enum Status { ACTIVE, CANCELED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Tier tier;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BillingPeriod period;

    /** Null means no known end: a granted plan, not a paid one. */
    @Column(name = "current_period_end")
    private Instant currentPeriodEnd;

    @Column
    private String provider;

    @Column(name = "provider_ref")
    private String providerRef;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    protected Subscription() {
    }

    public Subscription(Long userId) {
        this.userId = userId;
        this.tier = Tier.FREE;
        this.status = Status.CANCELED;
        this.period = BillingPeriod.MONTHLY;
    }

    @PreUpdate
    void touch() {
        this.updatedAt = Instant.now();
    }

    /**
     * The tier that actually applies right now. A cancelled row, or one whose
     * period has run out, is FREE — the row stays, the access does not.
     */
    public Tier tierNow() {
        if (status != Status.ACTIVE) {
            return Tier.FREE;
        }
        if (currentPeriodEnd != null && currentPeriodEnd.isBefore(Instant.now())) {
            return Tier.FREE;
        }
        return tier;
    }

    public void activate(Tier tier, BillingPeriod period, Instant periodEnd,
                         String provider, String providerRef) {
        this.tier = tier;
        this.period = period;
        this.status = Status.ACTIVE;
        this.currentPeriodEnd = periodEnd;
        this.provider = provider;
        this.providerRef = providerRef;
    }

    /**
     * Ends the plan now.
     *
     * Nothing is deleted and nothing is downgraded in the data: a shared
     * household keeps its members, and the account simply stops being read as
     * FAMILY. Re-subscribing puts everything back exactly where it was.
     */
    public void cancel() {
        this.status = Status.CANCELED;
    }

    public Long getId() {
        return id;
    }

    public Tier getTier() {
        return tier;
    }

    public Status getStatus() {
        return status;
    }

    public BillingPeriod getPeriod() {
        return period;
    }

    public Instant getCurrentPeriodEnd() {
        return currentPeriodEnd;
    }
}
