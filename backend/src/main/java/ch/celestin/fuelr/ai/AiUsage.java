package ch.celestin.fuelr.ai;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;

/**
 * One assisted read, and what it cost.
 *
 * A row per call rather than a running total: a total cannot be re-derived
 * when a price changes or a figure is doubted, and this is the only evidence
 * of what a subscriber actually costs.
 */
@Entity
@Table(name = "ai_usage")
public class AiUsage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** The first day of the month this call belongs to. */
    @Column(nullable = false)
    private LocalDate period;

    @Column(nullable = false)
    private String operation;

    @Column(nullable = false)
    private String provider;

    @Column(name = "input_tokens", nullable = false)
    private long inputTokens;

    @Column(name = "output_tokens", nullable = false)
    private long outputTokens;

    /** Micro-dollars: the provider bills per million tokens. */
    @Column(name = "cost_micros", nullable = false)
    private long costMicros;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected AiUsage() {
    }

    public AiUsage(Long userId, LocalDate period, String operation, String provider,
                   long inputTokens, long outputTokens, long costMicros) {
        this.userId = userId;
        this.period = period;
        this.operation = operation;
        this.provider = provider;
        this.inputTokens = inputTokens;
        this.outputTokens = outputTokens;
        this.costMicros = costMicros;
    }

    public Long getId() {
        return id;
    }

    public long getCostMicros() {
        return costMicros;
    }

    public long getInputTokens() {
        return inputTokens;
    }

    public long getOutputTokens() {
        return outputTokens;
    }
}
