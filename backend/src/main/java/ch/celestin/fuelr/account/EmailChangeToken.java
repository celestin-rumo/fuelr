package ch.celestin.fuelr.account;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * A pending change of address: the new email, and the one-time token that
 * will make it the login. Same shape as the verification and reset tokens,
 * for the same reasons — hashed at rest, single use, short-lived.
 */
@Entity
@Table(name = "email_change_tokens")
public class EmailChangeToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "new_email", nullable = false)
    private String newEmail;

    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "consumed_at")
    private Instant consumedAt;

    protected EmailChangeToken() {
    }

    public EmailChangeToken(Long userId, String newEmail, String tokenHash, Instant expiresAt) {
        this.userId = userId;
        this.newEmail = newEmail;
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
    }

    public Long getUserId() {
        return userId;
    }

    public String getNewEmail() {
        return newEmail;
    }

    public boolean isUsable() {
        return consumedAt == null && expiresAt.isAfter(Instant.now());
    }

    public void consume() {
        this.consumedAt = Instant.now();
    }
}
