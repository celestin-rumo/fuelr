package ch.celestin.fuelr.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

/**
 * Keeps the signing secret inside this package: the decoder is built here
 * rather than in SecurityConfig so JwtService's key handling stays internal.
 */
@Configuration
public class JwtConfig {

    @Bean
    public JwtDecoder jwtDecoder(@Value("${app.jwt.secret}") String secret) {
        return NimbusJwtDecoder
                .withSecretKey(JwtService.secretKey(secret))
                .macAlgorithm(JwtService.ALGORITHM)
                .build();
    }
}
