package ch.celestin.fuelr.auth;

import ch.celestin.fuelr.account.User;
import ch.celestin.fuelr.account.UserRepository;
import ch.celestin.fuelr.mail.MailService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

@Service
public class EmailVerificationService {

    /**
     * A week, not thirty minutes. Nothing is blocked while the address is
     * unproven, so there is no hurry — and a link that dies overnight only
     * produces people who click it on Monday and get an error.
     */
    static final Duration LIFETIME = Duration.ofDays(7);

    private final UserRepository users;
    private final EmailVerificationTokenRepository tokens;
    private final MailService mail;
    private final String siteUrl;

    public EmailVerificationService(
            UserRepository users,
            EmailVerificationTokenRepository tokens,
            MailService mail,
            @Value("${app.site-url}") String siteUrl) {
        this.users = users;
        this.tokens = tokens;
        this.mail = mail;
        this.siteUrl = siteUrl;
    }

    /** Sends a fresh link. Already-verified accounts are left alone. */
    @Transactional
    public void send(User user, String locale) {
        if (user.isEmailVerified()) {
            return;
        }

        String token = OneTimeToken.mint();
        tokens.save(new EmailVerificationToken(
                user.getId(), OneTimeToken.hash(token), Instant.now().plus(LIFETIME)));

        String link = EmailLinks.verifyEmail(siteUrl, locale, token);
        mail.send(user.getEmail(), "Confirme ton adresse Fuelr", """
                Bienvenue,

                Confirme ton adresse pour que Fuelr puisse te joindre :

                %s

                Le lien est valable %d jours. Ton compte fonctionne déjà, cette
                étape sert seulement à prouver que l'adresse est bien la tienne.
                """.formatted(link, LIFETIME.toDays()));
    }

    /**
     * Marks the address as proven.
     *
     * Returns true for an already-verified account rather than failing: people
     * click the same link twice, and telling them their confirmation did not
     * work is both false and alarming.
     */
    @Transactional
    public boolean verify(String token) {
        Optional<EmailVerificationToken> found =
                tokens.findByTokenHash(OneTimeToken.hash(token));
        if (found.isEmpty()) {
            return false;
        }
        EmailVerificationToken verification = found.get();

        Optional<User> user = users.findById(verification.getUserId());
        if (user.isEmpty()) {
            return false;
        }
        if (user.get().isEmailVerified()) {
            return true;
        }
        if (!verification.isUsable()) {
            return false;
        }

        user.get().markEmailVerified();
        users.save(user.get());
        verification.consume();
        tokens.save(verification);
        return true;
    }
}
