package ch.celestin.fuelr.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/** One issued token. Deleting the row is what makes a logout server-side. */
@Entity
@Table(name = "sessions")
public class Session {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "last_used_at", nullable = false)
    private Instant lastUsedAt = Instant.now();

    @Column(name = "device_label")
    private String deviceLabel;

    protected Session() {
    }

    public Session(Long userId, Instant expiresAt, String deviceLabel) {
        this.id = UUID.randomUUID();
        this.userId = userId;
        this.expiresAt = expiresAt;
        this.deviceLabel = deviceLabel;
    }

    public UUID getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public String getDeviceLabel() {
        return deviceLabel;
    }

    public void touch() {
        this.lastUsedAt = Instant.now();
    }
}
