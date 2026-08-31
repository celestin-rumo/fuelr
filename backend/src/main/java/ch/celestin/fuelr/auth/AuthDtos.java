package ch.celestin.fuelr.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Request and response payloads for /api/auth. */
public final class AuthDtos {

    private AuthDtos() {
    }

    public record RegisterRequest(
            @NotBlank @Email String email,
            @NotBlank String name,
            @NotBlank @Size(min = 8, message = "Le mot de passe fait au moins 8 caractères.")
            String password) {
    }

    public record LoginRequest(
            @NotBlank @Email String email,
            @NotBlank String password) {
    }

    /**
     * The token is returned in the body so a native client can store it itself.
     * The web client gets the same token as an httpOnly cookie and ignores this
     * field.
     */
    public record TokenResponse(String token, long expiresInSeconds, UserResponse user) {
    }

    public record UserResponse(Long id, String email, String name, String role) {
    }
}
