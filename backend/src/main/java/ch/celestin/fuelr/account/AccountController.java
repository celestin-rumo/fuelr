package ch.celestin.fuelr.account;

import ch.celestin.fuelr.auth.AuthDtos.UserResponse;
import ch.celestin.fuelr.auth.SessionTokenValidator;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

/**
 * The account page's own door.
 *
 * `/api/auth` is how a session starts and ends; this is what somebody does
 * with theirs once they have one. The split keeps the public surface small:
 * everything here needs a session, and the one endpoint that does not — the
 * click on a change-of-address link — lives beside the other links in
 * `AuthController`.
 */
@RestController
@RequestMapping("/api/account")
public class AccountController {

    public record UpdateRequest(@Size(max = 120) String name, @Size(max = 40) String locale) {
    }

    public record PasswordChangeRequest(
            @NotBlank String current,
            @NotBlank @Size(min = 8, message = "Le mot de passe fait au moins 8 caractères.")
            String next,
            String locale) {
    }

    public record EmailChangeRequest(
            @NotBlank @Email String email,
            @NotBlank String password,
            String locale) {
    }

    private final AccountService accounts;
    private final DataExportService exports;
    private final ch.celestin.fuelr.admin.AccountDeletion deletion;
    private final UserRepository users;
    private final ch.celestin.fuelr.auth.SessionService sessions;
    private final org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
    private final ch.celestin.fuelr.mail.MailService mail;
    private final String siteUrl;

    public AccountController(AccountService accounts, DataExportService exports,
                             ch.celestin.fuelr.admin.AccountDeletion deletion, UserRepository users,
                             ch.celestin.fuelr.auth.SessionService sessions,
                             org.springframework.security.crypto.password.PasswordEncoder passwordEncoder,
                             ch.celestin.fuelr.mail.MailService mail,
                             @org.springframework.beans.factory.annotation.Value("${app.site-url}") String siteUrl) {
        this.siteUrl = siteUrl;
        this.accounts = accounts;
        this.exports = exports;
        this.deletion = deletion;
        this.users = users;
        this.sessions = sessions;
        this.passwordEncoder = passwordEncoder;
        this.mail = mail;
    }

    public record LocaleRequest(String locale) {
    }

    public record ReferralView(String code, String link, long referred) {
    }

    /**
     * A link to share, and a count — never a list. No plan is paid for, so
     * there is nothing to thank anybody with, and this endpoint promises
     * nothing: it says how many came, which is the one thing worth knowing.
     */
    @org.springframework.web.bind.annotation.GetMapping("/referral")
    public ReferralView referral(@AuthenticationPrincipal Jwt principal) {
        AccountService.Referral referral = accounts.referral(userId(principal));
        return new ReferralView(referral.code(), siteUrl + "/?via=" + referral.code(), referral.referred());
    }

    public record ReminderRequest(Short day, Short hour) {
    }

    @org.springframework.web.bind.annotation.GetMapping("/reminder")
    public AccountService.Reminder reminder(@AuthenticationPrincipal Jwt principal) {
        return accounts.reminder(userId(principal));
    }

    /** Off by default, and off again with `day: null`. */
    @PutMapping("/reminder")
    public AccountService.Reminder setReminder(@AuthenticationPrincipal Jwt principal,
                                               @RequestBody ReminderRequest body) {
        return accounts.setReminder(userId(principal), body.day(), body.hour());
    }

    /** Asks for the archive. 202: it is being built, and a mail will say when. */
    @PostMapping("/export")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void requestExport(@AuthenticationPrincipal Jwt principal,
                              @RequestBody(required = false) LocaleRequest body) {
        Long userId = userId(principal);
        String token = exports.request(userId);
        exports.build(userId, token, body == null || body.locale() == null ? "fr" : body.locale());
    }

    /**
     * The one download. Public by token, like the other links that arrive by
     * mail: the person may open it on a device with no session. The file is
     * removed once streamed — a link is a link once.
     */
    @org.springframework.web.bind.annotation.GetMapping("/export/{token}")
    public void download(@org.springframework.web.bind.annotation.PathVariable String token,
                         jakarta.servlet.http.HttpServletResponse response) throws java.io.IOException {
        java.nio.file.Path file = exports.take(token).orElse(null);
        if (file == null || !java.nio.file.Files.exists(file)) {
            response.setStatus(HttpStatus.GONE.value());
            return;
        }
        response.setContentType("application/zip");
        response.setHeader("Content-Disposition", "attachment; filename=\"fuelr-export.zip\"");
        try {
            DataExportService.copy(file, response.getOutputStream());
        } finally {
            exports.discard(file);
        }
    }

    public record DeletionPreview(int recipes, int photos, boolean householdHandedOver,
                                  String newOwnerEmail) {
    }

    public record DeleteRequest(@NotBlank String password) {
    }

    /** What deleting would do, from what the server reports — not a generic sentence. */
    @org.springframework.web.bind.annotation.GetMapping("/deletion")
    public DeletionPreview previewDeletion(@AuthenticationPrincipal Jwt principal) {
        User user = users.findById(userId(principal))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        var removed = deletion.preview(user);
        return new DeletionPreview(removed.recipes(), removed.photos(),
                removed.householdHandedOver(), removed.newOwnerEmail());
    }

    /**
     * The same class the operator's panel calls, and no second way to delete
     * an account: the second way is the one that leaves photos behind. The
     * password re-entered, because an open tab must not be enough.
     */
    @org.springframework.web.bind.annotation.DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAccount(@AuthenticationPrincipal Jwt principal,
                              @Valid @RequestBody DeleteRequest body,
                              jakarta.servlet.http.HttpServletResponse response) {
        Long userId = userId(principal);
        User user = users.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        if (!passwordEncoder.matches(body.password(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "wrong_password");
        }
        String email = user.getEmail();
        exports.cancelFor(userId);
        sessions.closeAll(userId);
        deletion.delete(user);
        // The last thing the account sends.
        mail.send(email, "Ton compte Fuelr a été supprimé", """
                Bonjour,

                Ton compte Fuelr et ce qu'il contenait ont été supprimés, comme demandé.
                Il n'y a rien à faire de plus. Merci d'avoir cuisiné avec nous.
                """);
        response.setHeader(org.springframework.http.HttpHeaders.SET_COOKIE,
                org.springframework.http.ResponseCookie.from(
                        ch.celestin.fuelr.auth.CookieOrHeaderTokenResolver.COOKIE_NAME, "")
                        .httpOnly(true).path("/").maxAge(0).build().toString());
    }

    @PutMapping
    public UserResponse update(@AuthenticationPrincipal Jwt principal,
                               @Valid @RequestBody UpdateRequest body) {
        User user = accounts.update(userId(principal), body.name(), body.locale());
        return new UserResponse(user.getId(), user.getEmail(), user.getName(),
                user.getRole(), user.isEmailVerified(), user.getLocale());
    }

    @PutMapping("/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(@AuthenticationPrincipal Jwt principal,
                               @Valid @RequestBody PasswordChangeRequest body) {
        try {
            accounts.changePassword(userId(principal),
                    UUID.fromString(principal.getClaimAsString(SessionTokenValidator.CLAIM)),
                    body.current(), body.next(), body.locale() == null ? "fr" : body.locale());
        } catch (AccountService.WrongPasswordException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "wrong_password");
        }
    }

    /**
     * 202 whatever happens next: the mail is on its way, and what it says is
     * between the mail and its reader. Only a wrong password is refused here,
     * because that answer is about the caller and not about the address.
     */
    @PostMapping("/email")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void requestEmailChange(@AuthenticationPrincipal Jwt principal,
                                   @Valid @RequestBody EmailChangeRequest body) {
        try {
            accounts.requestEmailChange(userId(principal), body.email(), body.password(),
                    body.locale() == null ? "fr" : body.locale());
        } catch (AccountService.WrongPasswordException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "wrong_password");
        }
    }

    private static Long userId(Jwt principal) {
        return Long.valueOf(principal.getSubject());
    }
}
