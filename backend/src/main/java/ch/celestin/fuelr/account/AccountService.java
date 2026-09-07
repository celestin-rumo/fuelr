package ch.celestin.fuelr.account;

import ch.celestin.fuelr.auth.EmailLinks;
import ch.celestin.fuelr.auth.OneTimeToken;
import ch.celestin.fuelr.auth.SessionService;
import ch.celestin.fuelr.mail.MailService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

/**
 * What somebody may change about their own account, and how.
 *
 * Three things here are not ordinary edits and are handled as what they are.
 * The **email is the login**: changing it without proof hands the account to
 * whoever mistypes, and changing it without telling the old address is how a
 * stolen account goes unnoticed — so the new address gets a link, the old one
 * gets a notice, and nothing moves until the link is clicked. A **password
 * change that leaves the other sessions open has changed nothing** for
 * whoever holds the previous one, so they are closed. And whether an address
 * is already taken is **never said** to the person asking: the reply, and its
 * timing, are the same either way, as they are at registration.
 */
@Service
public class AccountService {

    static final Duration EMAIL_CHANGE_LIFETIME = Duration.ofDays(2);

    private final UserRepository users;
    private final EmailChangeTokenRepository tokens;
    private final SessionService sessions;
    private final PasswordEncoder passwordEncoder;
    private final MailService mail;
    private final String siteUrl;

    public AccountService(UserRepository users, EmailChangeTokenRepository tokens,
                          SessionService sessions, PasswordEncoder passwordEncoder,
                          MailService mail, @Value("${app.site-url}") String siteUrl) {
        this.users = users;
        this.tokens = tokens;
        this.sessions = sessions;
        this.passwordEncoder = passwordEncoder;
        this.mail = mail;
        this.siteUrl = siteUrl;
    }

    @Transactional
    public User update(Long userId, String name, String locale) {
        User user = users.findById(userId).orElseThrow(UnknownUserException::new);
        if (name != null && !name.isBlank()) {
            user.rename(name.trim());
        }
        if (locale != null) {
            user.setLocale(knownLocale(locale));
        }
        return users.save(user);
    }

    /**
     * The current password is the proof, and it is checked the way a login
     * checks it — the same hash computed whether or not it will match, so the
     * answer takes the same time either way.
     */
    @Transactional
    public void changePassword(Long userId, UUID keepSession, String current, String next,
                               String locale) {
        User user = users.findById(userId).orElseThrow(UnknownUserException::new);
        if (!passwordEncoder.matches(current, user.getPasswordHash())) {
            throw new WrongPasswordException();
        }
        user.changePassword(passwordEncoder.encode(next));
        user.clearFailures();
        users.save(user);
        sessions.closeOthers(userId, keepSession);
        mail.send(user.getEmail(), "Ton mot de passe Fuelr a changé", """
                Bonjour,

                Le mot de passe de ton compte Fuelr vient d'être changé, et les
                autres appareils ont été déconnectés.

                Si ce n'était pas toi, réinitialise-le tout de suite :
                %s

                """.formatted(EmailLinks.forgotPassword(siteUrl, locale)));
    }

    /**
     * Starts a change of address. Answers nothing about whether the new
     * address is taken: a mail goes out to it either way, and only when it is
     * free does that mail carry a link. The old address is told in both cases,
     * because it is the one that would want to know.
     */
    @Transactional
    public void requestEmailChange(Long userId, String newEmail, String password, String locale) {
        User user = users.findById(userId).orElseThrow(UnknownUserException::new);
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new WrongPasswordException();
        }
        String normalised = newEmail.trim().toLowerCase(Locale.ROOT);
        if (normalised.equals(user.getEmail())) {
            return;
        }

        boolean taken = users.findByEmail(normalised).isPresent();
        if (taken) {
            mail.send(normalised, "Fuelr — cette adresse a déjà un compte", """
                    Bonjour,

                    Quelqu'un a demandé à rattacher cette adresse à un autre compte
                    Fuelr. Elle en a déjà un, alors rien n'a changé. Si c'était toi,
                    connecte-toi avec cette adresse plutôt que de la déplacer.
                    """);
        } else {
            String token = OneTimeToken.mint();
            tokens.save(new EmailChangeToken(userId, normalised, OneTimeToken.hash(token),
                    Instant.now().plus(EMAIL_CHANGE_LIFETIME)));
            mail.send(normalised, "Confirme ta nouvelle adresse Fuelr", """
                    Bonjour,

                    Confirme que cette adresse est bien la tienne pour qu'elle devienne
                    celle de ton compte Fuelr :
                    %s

                    Le lien est valable %d jours. Tant qu'il n'est pas cliqué, rien ne change.
                    """.formatted(EmailLinks.emailChange(siteUrl, locale, token),
                            EMAIL_CHANGE_LIFETIME.toDays()));
        }
        mail.send(user.getEmail(), "Fuelr — changement d'adresse demandé", """
                Bonjour,

                Une demande a été faite pour remplacer cette adresse par une autre
                sur ton compte Fuelr. Rien ne change tant que la nouvelle adresse
                n'a pas été confirmée.

                Si ce n'était pas toi, change ton mot de passe dès maintenant.
                """);
    }

    /** The click. Idempotent on a used link, like the other two token flows. */
    @Transactional
    public boolean confirmEmailChange(String token) {
        Optional<EmailChangeToken> found = tokens.findByTokenHash(OneTimeToken.hash(token));
        if (found.isEmpty() || !found.get().isUsable()) {
            return false;
        }
        EmailChangeToken change = found.get();
        Optional<User> user = users.findById(change.getUserId());
        if (user.isEmpty()) {
            return false;
        }
        // Taken between the request and the click: the link is dead, and it
        // says so the same way an expired one does.
        if (users.findByEmail(change.getNewEmail()).isPresent()) {
            return false;
        }
        user.get().changeEmail(change.getNewEmail());
        users.save(user.get());
        change.consume();
        tokens.save(change);
        return true;
    }

    private static String knownLocale(String locale) {
        String cleaned = locale.trim().toLowerCase(Locale.ROOT);
        return switch (cleaned) {
            case "fr", "en", "de" -> cleaned;
            default -> null;
        };
    }

    public static class WrongPasswordException extends RuntimeException {
    }

    public static class UnknownUserException extends RuntimeException {
    }
}
