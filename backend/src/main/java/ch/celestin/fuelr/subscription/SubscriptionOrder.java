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
 * Somebody asked for a plan.
 *
 * It exists before payment does, and it stays PENDING until something confirms
 * it. That is the seam: when a provider is wired, the order carries the id it
 * hands back, and its webhook flips the same row to PAID through
 * {@link SubscriptionService#confirm}. Until then a pending order is the
 * honest record of a sale we could not yet make.
 */
@Entity
@Table(name = "subscription_orders")
public class SubscriptionOrder {

    public enum Status { PENDING, PAID }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Tier tier;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BillingPeriod period;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.PENDING;

    @Column
    private String provider;

    @Column(name = "provider_ref")
    private String providerRef;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    protected SubscriptionOrder() {
    }

    public SubscriptionOrder(Long userId, Tier tier, BillingPeriod period) {
        this.userId = userId;
        this.tier = tier;
        this.period = period;
    }

    @PreUpdate
    void touch() {
        this.updatedAt = Instant.now();
    }

    /**
     * Names the provider and the checkout before anything is paid.
     *
     * Written on the way out rather than on the way back: a webhook can arrive
     * before the customer returns from the checkout, and an order that cannot
     * be recognised then is a payment nobody can match to anybody.
     */
    public void awaitPayment(String provider, String providerRef) {
        this.provider = provider;
        this.providerRef = providerRef;
    }

    public void markPaid(String provider, String providerRef) {
        this.status = Status.PAID;
        this.provider = provider;
        this.providerRef = providerRef;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public Tier getTier() {
        return tier;
    }

    public BillingPeriod getPeriod() {
        return period;
    }

    public Status getStatus() {
        return status;
    }

    public String getProvider() {
        return provider;
    }

    public String getProviderRef() {
        return providerRef;
    }
}
