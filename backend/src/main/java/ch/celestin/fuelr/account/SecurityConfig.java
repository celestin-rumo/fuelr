package ch.celestin.fuelr.account;

import ch.celestin.fuelr.auth.CookieOrHeaderTokenResolver;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import jakarta.servlet.DispatcherType;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * Stateless: there is no session to fix, so CSRF protection is not what
     * guards these endpoints — the token is. Anything outside the public
     * endpoints below needs a valid token, from either the header or the
     * cookie.
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // An error raised inside a permitted endpoint is re-dispatched
                // to /error. Without this, every failure on a public endpoint
                // comes back as 401 instead of its real status — a duplicate
                // registration reported itself as "unauthenticated".
                .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                .requestMatchers("/api/health").permitAll()
                .requestMatchers(HttpMethod.POST,
                        "/api/auth/register", "/api/auth/login",
                        "/api/auth/forgot-password", "/api/auth/reset-password").permitAll()
                .anyRequest().authenticated())
            .oauth2ResourceServer(oauth -> oauth
                .bearerTokenResolver(new CookieOrHeaderTokenResolver())
                .jwt(jwt -> {}));
        return http.build();
    }
}
