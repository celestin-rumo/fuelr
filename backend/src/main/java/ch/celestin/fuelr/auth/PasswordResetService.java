package ch.celestin.fuelr.auth;

import ch.celestin.fuelr.account.User;
import ch.celestin.fuelr.account.UserRepository;
import ch.celestin.fuelr.mail.MailService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;

@Service
public class PasswordResetService {

    /** Long enough to be pointless to guess, short enough to paste. */
    static final Duration LIFETIME = Duration.ofMinutes(30);

    private static final SecureRandom RANDOM = new SecureRandom();

    /**
     * The slug of the reset screen per locale. It duplicates
     * `frontend/i18n/routing.ts`, which is unfortunate, but the alternative is
     * worse: letting the caller pass the link to embed would turn this
     * endpoint into a way to send phishing from a Fuelr address.
     */
    private static final java.util.Map<String, String> RESET_PATH = java.util.Map.of(
            "fr", "/nouveau-mot-de-passe",
            "en", "/reset-password",
            "de", "/neues-passwort");

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

        byte[] raw = new byte[32];
        RANDOM.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);

        tokens.save(new PasswordResetToken(
                user.getId(), hash(token), Instant.now().plus(LIFETIME)));

        String path = RESET_PATH.getOrDefault(locale, RESET_PATH.get("fr"));
        String safeLocale = RESET_PATH.containsKey(locale) ? locale : "fr";
        String link = "%s/%s%s?token=%s".formatted(siteUrl, safeLocale, path, token);
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
        Optional<PasswordResetToken> found = tokens.findByTokenHash(hash(token));
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

    static String hash(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return java.util.HexFormat.of()
                    .formatHex(digest.digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
