package ch.celestin.fuelr.shopping;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;

/** One list per household per week. Last week's ticks are not this week's. */
@Entity
@Table(name = "shopping_lists")
public class ShoppingList {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "household_id", nullable = false)
    private Long householdId;

    @Column(name = "week_start", nullable = false)
    private LocalDate weekStart;

    @Column(name = "generated_at", nullable = false)
    private Instant generatedAt = Instant.now();

    protected ShoppingList() {
    }

    public ShoppingList(Long householdId, LocalDate weekStart) {
        this.householdId = householdId;
        this.weekStart = weekStart;
    }

    public void regenerated() {
        this.generatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Long getHouseholdId() {
        return householdId;
    }

    public LocalDate getWeekStart() {
        return weekStart;
    }

    public Instant getGeneratedAt() {
        return generatedAt;
    }
}
