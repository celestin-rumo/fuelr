package ch.celestin.fuelr.account;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/** One archive somebody asked for, and the one link that fetches it. */
@Entity
@Table(name = "data_exports")
public class DataExport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    private String path;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "ready_at")
    private Instant readyAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "downloaded_at")
    private Instant downloadedAt;

    protected DataExport() {
    }

    public DataExport(Long userId, String tokenHash, Instant expiresAt) {
        this.userId = userId;
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public String getPath() {
        return path;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public boolean isReady() {
        return readyAt != null && path != null;
    }

    public boolean isUsable() {
        return isReady() && downloadedAt == null && expiresAt.isAfter(Instant.now());
    }

    public void ready(String path) {
        this.path = path;
        this.readyAt = Instant.now();
    }

    public void downloaded() {
        this.downloadedAt = Instant.now();
    }
}
