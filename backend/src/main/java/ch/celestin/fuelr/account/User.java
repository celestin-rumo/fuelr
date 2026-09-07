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

    /**
     * When the address was proven. Null means unverified, which is a normal
     * state for a working account — nothing is withheld because of it.
     */
    @Column(name = "email_verified_at")
    private Instant emailVerifiedAt;

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

    /**
     * Only `AdminAccountInitializer` writes this, and only ever upwards: the
     * operator is named in configuration, and losing the role must not be a
     * side effect of an environment variable changing.
     */
    public void setRole(String role) {
        this.role = role;
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

    public boolean isEmailVerified() {
        return emailVerifiedAt != null;
    }

    public void markEmailVerified() {
        this.emailVerifiedAt = Instant.now();
    }

    /**
     * The language the account reads in. Null until chosen: the browser's
     * guess is fine for a visitor, and this is what makes it stop being a
     * guess once somebody has said.
     */
    @Column(length = 5)
    private String locale;

    public String getLocale() {
        return locale;
    }

    public void setLocale(String locale) {
        this.locale = locale;
    }

    @Column(name = "referral_code", length = 12, unique = true)
    private String referralCode;

    @Column(name = "referred_by")
    private Long referredBy;

    /** ISO day 1–7, or null while the reminder is off — which is the default. */
    @Column(name = "reminder_day")
    private Short reminderDay;

    @Column(name = "reminder_hour")
    private Short reminderHour;

    @Column(name = "reminder_token", length = 64, unique = true)
    private String reminderToken;

    public String getReferralCode() {
        return referralCode;
    }

    /** Minted once, the first time the link is looked at, and never changed. */
    public String ensureReferralCode(String minted) {
        if (referralCode == null) {
            referralCode = minted;
        }
        return referralCode;
    }

    public Long getReferredBy() {
        return referredBy;
    }

    public void setReferredBy(Long referredBy) {
        this.referredBy = referredBy;
    }

    public Short getReminderDay() {
        return reminderDay;
    }

    public Short getReminderHour() {
        return reminderHour;
    }

    public String getReminderToken() {
        return reminderToken;
    }

    public void setReminder(Short day, Short hour, String tokenIfNone) {
        this.reminderDay = day;
        this.reminderHour = day == null ? null : hour;
        if (day != null && reminderToken == null) {
            reminderToken = tokenIfNone;
        }
    }

    public void rename(String name) {
        this.name = name;
    }

    /**
     * The address becomes the login only here, and only after the link sent
     * to it was clicked — which is also what proves it, so the new address
     * arrives verified.
     */
    public void changeEmail(String email) {
        this.email = email;
        this.emailVerifiedAt = java.time.Instant.now();
    }

    public void changePassword(String encodedPassword) {
        this.passwordHash = encodedPassword;
    }

    public void clearFailures() {
        this.failedLogins = 0;
        this.lockedUntil = null;
    }
}
