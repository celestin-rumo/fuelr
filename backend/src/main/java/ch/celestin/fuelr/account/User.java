package ch.celestin.fuelr.account;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    /** Display name. Optional: the bootstrapped admin has none. */
    @Column
    private String name;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(nullable = false)
    private String role;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "failed_logins", nullable = false)
    private int failedLogins = 0;

    /** Set while a delay is in force after repeated failures. */
    @Column(name = "locked_until")
    private Instant lockedUntil;

    protected User() {
    }

    public User(String email, String passwordHash, String role) {
        this(email, null, passwordHash, role);
    }

    public User(String email, String name, String passwordHash, String role) {
        this.email = email;
        this.name = name;
        this.passwordHash = passwordHash;
        this.role = role;
    }

    public String getName() {
        return name;
    }

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public String getRole() {
        return role;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public int getFailedLogins() {
        return failedLogins;
    }

    public Instant getLockedUntil() {
        return lockedUntil;
    }

    public void recordFailure(java.time.Duration delay) {
        this.failedLogins++;
        this.lockedUntil = delay.isZero() ? null : Instant.now().plus(delay);
    }

    public void clearFailures() {
        this.failedLogins = 0;
        this.lockedUntil = null;
    }
}
