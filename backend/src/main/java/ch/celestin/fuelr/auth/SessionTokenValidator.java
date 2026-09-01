package ch.celestin.fuelr.auth;

import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.UUID;

/**
 * Rejects a token whose session no longer exists.
 *
 * A signed JWT is valid until it expires, which is exactly what makes logout
 * meaningless without something like this: the signature keeps checking out
 * long after the person pressed the button. Checking the session on every
 * request costs one indexed lookup and buys real revocation.
 */
public class SessionTokenValidator implements OAuth2TokenValidator<Jwt> {

    static final String CLAIM = "sid";

    private static final OAuth2Error REVOKED =
            new OAuth2Error("invalid_token", "The session is closed.", null);

    private final SessionService sessions;

    public SessionTokenValidator(SessionService sessions) {
        this.sessions = sessions;
    }

    @Override
    public OAuth2TokenValidatorResult validate(Jwt token) {
        String sid = token.getClaimAsString(CLAIM);
        if (sid == null) {
            // Tokens issued before sessions existed carry no session.
            return OAuth2TokenValidatorResult.failure(REVOKED);
        }
        try {
            return sessions.isLive(UUID.fromString(sid))
                    ? OAuth2TokenValidatorResult.success()
                    : OAuth2TokenValidatorResult.failure(REVOKED);
        } catch (IllegalArgumentException e) {
            return OAuth2TokenValidatorResult.failure(REVOKED);
        }
    }
}
