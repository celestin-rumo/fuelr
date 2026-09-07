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

    public AccountController(AccountService accounts) {
        this.accounts = accounts;
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
