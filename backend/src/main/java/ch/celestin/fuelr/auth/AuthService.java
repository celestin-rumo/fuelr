package ch.celestin.fuelr.auth;

import ch.celestin.fuelr.account.User;
import ch.celestin.fuelr.account.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

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

    /**
     * Verifies credentials. The caller must not be told which half was wrong —
     * a different answer for a missing account leaks which emails are
     * registered.
     */
    public User authenticate(String email, String rawPassword) {
        Optional<User> found = users.findByEmail(normalise(email));
        if (found.isEmpty()
                || !passwordEncoder.matches(rawPassword, found.get().getPasswordHash())) {
            throw new InvalidCredentialsException();
        }
        return found.get();
    }

    private static String normalise(String email) {
        return email.trim().toLowerCase();
    }

    public static class EmailAlreadyUsedException extends RuntimeException {
    }

    public static class InvalidCredentialsException extends RuntimeException {
    }
}
