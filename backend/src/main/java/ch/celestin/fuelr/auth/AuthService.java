package ch.celestin.fuelr.auth;

import ch.celestin.fuelr.account.User;
import ch.celestin.fuelr.account.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

@Service
public class AuthService {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;

    public AuthService(UserRepository users, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    public User register(String email, String name, String rawPassword) {
        String normalised = normalise(email);
        if (users.findByEmail(normalised).isPresent()) {
            throw new EmailAlreadyUsedException();
        }
        return users.save(new User(normalised, name, passwordEncoder.encode(rawPassword), "USER"));
    }

    /** Free attempts before a delay starts. */
    static final int FREE_ATTEMPTS = 3;

    /**
     * How long the account is held after {@code failures} failed attempts:
     * 10 s, then 20, 40, 80… capped at five minutes. Slow enough to make
     * guessing pointless, short enough that a genuine typo is not a lockout.
     */
    static Duration delayAfter(int failures) {
        if (failures <= FREE_ATTEMPTS) {
            return Duration.ZERO;
        }
        long seconds = Math.min(300, 10L << Math.min(failures - FREE_ATTEMPTS - 1, 8));
        return Duration.ofSeconds(seconds);
    }

    /**
     * Verifies credentials. The caller must not be told which half was wrong —
     * a different answer for a missing account leaks which emails are
     * registered.
     */
    // The failure counter is written and then an exception is thrown. Without
    // noRollbackFor, that exception rolls the transaction back and discards the
    // very count it was raised about — so the delay would never start.
    @org.springframework.transaction.annotation.Transactional(
            noRollbackFor = {InvalidCredentialsException.class, TooManyAttemptsException.class})
    public User authenticate(String email, String rawPassword) {
        Optional<User> found = users.findByEmail(normalise(email));

        // An unknown email is refused exactly like a wrong password, with no
        // counter to update: counting attempts on accounts that do not exist
        // would let someone probe for real ones by timing.
        if (found.isEmpty()) {
            throw new InvalidCredentialsException();
        }

        User user = found.get();
        if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(Instant.now())) {
            throw new TooManyAttemptsException(
                    Duration.between(Instant.now(), user.getLockedUntil()));
        }

        if (!passwordEncoder.matches(rawPassword, user.getPasswordHash())) {
            user.recordFailure(delayAfter(user.getFailedLogins() + 1));
            users.save(user);
            throw new InvalidCredentialsException();
        }

        user.clearFailures();
        return users.save(user);
    }

    private static String normalise(String email) {
        return email.trim().toLowerCase();
    }

    public static class EmailAlreadyUsedException extends RuntimeException {
    }

    public static class InvalidCredentialsException extends RuntimeException {
    }

    public static class TooManyAttemptsException extends RuntimeException {
        private final Duration retryAfter;

        public TooManyAttemptsException(Duration retryAfter) {
            this.retryAfter = retryAfter;
        }

        public Duration retryAfter() {
            return retryAfter;
        }
    }
}
