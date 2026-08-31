package ch.celestin.fuelr.auth;

import ch.celestin.fuelr.account.User;
import ch.celestin.fuelr.account.UserRepository;
import ch.celestin.fuelr.auth.AuthDtos.LoginRequest;
import ch.celestin.fuelr.auth.AuthDtos.RegisterRequest;
import ch.celestin.fuelr.auth.AuthDtos.TokenResponse;
import ch.celestin.fuelr.auth.AuthDtos.UserResponse;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService auth;
    private final JwtService jwt;
    private final UserRepository users;
    private final boolean secureCookie;

    public AuthController(
            AuthService auth,
            JwtService jwt,
            UserRepository users,
            @Value("${app.jwt.secure-cookie}") boolean secureCookie) {
        this.auth = auth;
        this.jwt = jwt;
        this.users = users;
        this.secureCookie = secureCookie;
    }

    @PostMapping("/register")
    public ResponseEntity<TokenResponse> register(@Valid @RequestBody RegisterRequest body) {
        User user;
        try {
            user = auth.register(body.email(), body.name(), body.password());
        } catch (AuthService.EmailAlreadyUsedException e) {
            // Registration is the one place the app may say the address is
            // taken: the person is in front of the form and needs to be sent
            // to the login screen. Login and password reset stay silent.
            throw new ResponseStatusException(HttpStatus.CONFLICT, "email_already_used");
        }
        return tokenResponse(user, HttpStatus.CREATED);
    }

    @PostMapping("/login")
    public ResponseEntity<TokenResponse> login(@Valid @RequestBody LoginRequest body) {
        User user;
        try {
            user = auth.authenticate(body.email(), body.password());
        } catch (AuthService.InvalidCredentialsException e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid_credentials");
        }
        return tokenResponse(user, HttpStatus.OK);
    }

    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal Jwt principal) {
        Long id = Long.valueOf(principal.getSubject());
        User user = users.findById(id).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "unknown_user"));
        return toResponse(user);
    }

    private ResponseEntity<TokenResponse> tokenResponse(User user, HttpStatus status) {
        String token = jwt.issue(user);
        long seconds = jwt.ttl().toSeconds();

        // The browser gets the token as an httpOnly cookie so page scripts
        // cannot read it; native clients read it from the body instead.
        ResponseCookie cookie = ResponseCookie.from(CookieOrHeaderTokenResolver.COOKIE_NAME, token)
                .httpOnly(true)
                .secure(secureCookie)
                .sameSite("Lax")
                .path("/")
                .maxAge(seconds)
                .build();

        return ResponseEntity.status(status)
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(new TokenResponse(token, seconds, toResponse(user)));
    }

    private static UserResponse toResponse(User user) {
        return new UserResponse(user.getId(), user.getEmail(), user.getName(), user.getRole());
    }
}
