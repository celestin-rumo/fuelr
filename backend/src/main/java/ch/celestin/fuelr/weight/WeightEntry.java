package ch.celestin.fuelr.weight;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.LocalDate;

/** One weigh-in: a figure and the day it was true. */
@Entity
@Table(name = "weight_entries")
public class WeightEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "weighed_on", nullable = false)
    private LocalDate weighedOn;

    @Column(name = "weight_kg", nullable = false, precision = 5, scale = 1)
    private BigDecimal weightKg;

    protected WeightEntry() {
    }

    public WeightEntry(Long userId, LocalDate weighedOn, BigDecimal weightKg) {
        this.userId = userId;
        this.weighedOn = weighedOn;
        this.weightKg = weightKg;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public LocalDate getWeighedOn() {
        return weighedOn;
    }

    public BigDecimal getWeightKg() {
        return weightKg;
    }

    public void setWeightKg(BigDecimal weightKg) {
        this.weightKg = weightKg;
    }
}
