package ch.celestin.fuelr.shopping;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Something already at home.
 *
 * Held per household, like the plan: the cupboard is shared by whoever cooks
 * out of it. A row that reaches zero is deleted rather than kept — an empty
 * shelf is not a fact worth storing, and it would otherwise show up as "in
 * stock: 0" and cover nothing.
 */
@Entity
@Table(name = "pantry_items")
public class PantryItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "household_id", nullable = false)
    private Long householdId;

    @Column(nullable = false)
    private String name;

    @Column(name = "match_name", nullable = false)
    private String matchName;

    @Column(nullable = false)
    private BigDecimal quantity;

    @Column(nullable = false)
    private String unit;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    protected PantryItem() {
    }

    public PantryItem(Long householdId, String name, String matchName,
                      BigDecimal quantity, String unit) {
        this.householdId = householdId;
        this.name = name;
        this.matchName = matchName;
        this.quantity = quantity;
        this.unit = unit;
    }

    @PreUpdate
    void touch() {
        this.updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Long getHouseholdId() {
        return householdId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getMatchName() {
        return matchName;
    }

    public BigDecimal getQuantity() {
        return quantity;
    }

    public void setQuantity(BigDecimal quantity) {
        this.quantity = quantity;
    }

    public String getUnit() {
        return unit;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
