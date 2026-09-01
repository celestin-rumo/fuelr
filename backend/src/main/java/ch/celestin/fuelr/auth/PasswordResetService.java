package ch.celestin.fuelr.auth;

import ch.celestin.fuelr.account.User;
import ch.celestin.fuelr.account.UserRepository;
import ch.celestin.fuelr.mail.MailService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

@Service
public class PasswordResetService {

    /** Long enough to be pointless to guess, short enough to paste. */
    static final Duration LIFETIME = Duration.ofMinutes(30);

    private final UserRepository users;
    private final PasswordResetTokenRepository tokens;
    private final SessionService sessions;
    private final PasswordEncoder passwordEncoder;
    private final MailService mail;
    private final String siteUrl;

    public PasswordResetService(
            UserRepository users,
            PasswordResetTokenRepository tokens,
            SessionService sessions,
            PasswordEncoder passwordEncoder,
            MailService mail,
            @Value("${app.site-url}") String siteUrl) {
        this.users = users;
        this.tokens = tokens;
        this.sessions = sessions;
        this.passwordEncoder = passwordEncoder;
        this.mail = mail;
        this.siteUrl = siteUrl;
    }

    /**
     * Starts a reset if the address belongs to an account, and does nothing
     * visible otherwise.
     *
     * The caller gets the same answer either way. Telling someone that an
     * address is unknown turns this endpoint into a way to test which emails
     * are registered.
     */
    @Transactional
    public void request(String email, String locale) {
        Optional<User> found = users.findByEmail(email.trim().toLowerCase());
        if (found.isEmpty()) {
            return;
        }
        User user = found.get();

        String token = OneTimeToken.mint();

        tokens.save(new PasswordResetToken(
                user.getId(), OneTimeToken.hash(token), Instant.now().plus(LIFETIME)));

        String link = EmailLinks.resetPassword(siteUrl, locale, token);
        mail.send(user.getEmail(), "Réinitialiser ton mot de passe Fuelr", """
                Bonjour,

                Voici le lien pour choisir un nouveau mot de passe Fuelr :

                %s

                Il est valable %d minutes et ne fonctionne qu'une fois.

                Si tu n'es pas à l'origine de cette demande, ignore ce message :
                ton mot de passe actuel reste valable.
                """.formatted(link, LIFETIME.toMinutes()));
    }

    /**
     * Sets the new password and closes every session, including the one that
     * asked. Whoever knew the old password is signed out everywhere.
     */
    @Transactional
    public boolean reset(String token, String newPassword) {
        Optional<PasswordResetToken> found = tokens.findByTokenHash(OneTimeToken.hash(token));
        if (found.isEmpty() || !found.get().isUsable()) {
            return false;
        }
        PasswordResetToken reset = found.get();
        Optional<User> user = users.findById(reset.getUserId());
        if (user.isEmpty()) {
            return false;
        }

        user.get().changePassword(passwordEncoder.encode(newPassword));
        user.get().clearFailures();
        users.save(user.get());

        reset.consume();
        tokens.save(reset);

        sessions.closeAll(reset.getUserId());
        return true;
    }
}
