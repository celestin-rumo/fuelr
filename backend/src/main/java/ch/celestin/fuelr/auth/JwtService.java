package ch.celestin.fuelr.auth;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Service;

import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;

import ch.celestin.fuelr.account.User;

/**
 * Issues the access token the API accepts.
 *
 * A signed JWT rather than a server-side session, because the same token has to
 * work from a React Native app that has no cookie jar. The web client stores it
 * in an httpOnly cookie; a native client keeps it in secure storage and sends
 * it as `Authorization: Bearer …`. Both hit the same endpoints.
 */
@Service
public class JwtService {

    static final MacAlgorithm ALGORITHM = MacAlgorithm.HS256;

    private final JwtEncoder encoder;
    private final Duration ttl;

    public JwtService(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.ttl}") Duration ttl) {
        this.encoder = new NimbusJwtEncoder(new ImmutableSecret<>(secretKey(secret)));
        this.ttl = ttl;
    }

    static SecretKeySpec secretKey(String secret) {
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            throw new IllegalStateException(
                    "app.jwt.secret must be at least 32 bytes for HS256; got " + bytes.length);
        }
        return new SecretKeySpec(bytes, "HmacSHA256");
    }

    /** The session id travels in the token, so it can be revoked server-side. */
    public String issue(User user, java.util.UUID sessionId) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("fuelr")
                .issuedAt(now)
                .expiresAt(now.plus(ttl))
                .subject(String.valueOf(user.getId()))
                .claim("email", user.getEmail())
                .claim("role", user.getRole())
                .claim(SessionTokenValidator.CLAIM, sessionId.toString())
                .build();
        return encoder.encode(
                JwtEncoderParameters.from(JwsHeader.with(ALGORITHM).build(), claims)).getTokenValue();
    }

    public Duration ttl() {
        return ttl;
    }
}
