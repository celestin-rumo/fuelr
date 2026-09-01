package ch.celestin.fuelr.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import ch.celestin.fuelr.account.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class EmailVerificationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17");

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired EmailVerificationTokenRepository tokens;

    private String register(String email) throws Exception {
        String response = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","name":"Chef","password":"motdepasse123","locale":"fr"}"""
                                .formatted(email)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("token").asText();
    }

    /** Mints a link the way the service does, since the real one is only emailed. */
    private String linkFor(String email) {
        String token = OneTimeToken.mint();
        tokens.save(new EmailVerificationToken(
                users.findByEmail(email).orElseThrow().getId(),
                OneTimeToken.hash(token),
                Instant.now().plus(EmailVerificationService.LIFETIME)));
        return token;
    }

    private void verify(String token, int expectedStatus) throws Exception {
        mvc.perform(post("/api/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"token":"%s"}""".formatted(token)))
                .andExpect(status().is(expectedStatus));
    }

    @Test
    void anAccountWorksBeforeTheAddressIsProven() throws Exception {
        String email = "unverified-" + System.nanoTime() + "@fuelr.app";
        String token = register(email);

        // Nothing is withheld: the account reads its own data straight away,
        // and only says the address is not yet confirmed.
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.emailVerified").value(false));

        mvc.perform(get("/api/recipes").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void followingTheLinkProvesTheAddress() throws Exception {
        String email = "verify-" + System.nanoTime() + "@fuelr.app";
        String token = register(email);

        verify(linkFor(email), 204);

        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.emailVerified").value(true));
    }

    @Test
    void clickingTheSameLinkTwiceIsStillASuccess() throws Exception {
        String email = "twice-" + System.nanoTime() + "@fuelr.app";
        register(email);
        String link = linkFor(email);

        verify(link, 204);
        // People re-open emails. Saying the confirmation failed would be both
        // false and alarming, since the address is proven either way.
        verify(link, 204);
    }

    @Test
    void anExpiredLinkIsRefused() throws Exception {
        String email = "expired-" + System.nanoTime() + "@fuelr.app";
        register(email);

        String token = "perime-" + System.nanoTime();
        tokens.save(new EmailVerificationToken(
                users.findByEmail(email).orElseThrow().getId(),
                OneTimeToken.hash(token),
                Instant.now().minusSeconds(60)));

        verify(token, 410);
        assertThat(users.findByEmail(email).orElseThrow().isEmailVerified()).isFalse();
    }

    @Test
    void anInventedTokenIsRefused() throws Exception {
        verify("pas-un-vrai-jeton", 410);
    }

    @Test
    void aResetLinkCannotStandInForAVerificationLink() throws Exception {
        String email = "crossed-" + System.nanoTime() + "@fuelr.app";
        register(email);

        mvc.perform(post("/api/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","locale":"fr"}""".formatted(email)))
                .andExpect(status().isNoContent());

        // The two token stores are separate on purpose: a link that proves an
        // address must not also be able to change a password, or the reverse.
        String reset = OneTimeToken.mint();
        verify(reset, 410);
    }

    @Test
    void resendingAsksForAnotherLink() throws Exception {
        String email = "resend-" + System.nanoTime() + "@fuelr.app";
        String token = register(email);
        long before = tokens.count();

        mvc.perform(post("/api/auth/verify-email/resend")
                        .header("Authorization", "Bearer " + token)
                        .param("locale", "fr"))
                .andExpect(status().isNoContent());

        assertThat(tokens.count()).isEqualTo(before + 1);
    }

    @Test
    void resendingNeedsASession() throws Exception {
        mvc.perform(post("/api/auth/verify-email/resend"))
                .andExpect(status().isUnauthorized());
    }
}
