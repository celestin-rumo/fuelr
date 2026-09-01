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
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class PasswordResetTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17");

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired PasswordResetTokenRepository tokens;
    @Autowired UserRepository users;

    private String register(String email) throws Exception {
        String response = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","name":"Chef","password":"motdepasse123"}"""
                                .formatted(email)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("token").asText();
    }

    private void forgot(String email) throws Exception {
        mvc.perform(post("/api/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","locale":"fr"}""".formatted(email)))
                .andExpect(status().isNoContent());
    }

    /**
     * Mints a link the same way the service does. The raw token only ever
     * exists in the email, so a test that needs one has to make its own.
     */
    private String requestAndCaptureToken(String email) {
        // Mirrors PasswordResetService.request, so the hash matches.
        byte[] raw = new byte[32];
        new java.security.SecureRandom().nextBytes(raw);
        String token = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        Long userId = users.findByEmail(email).orElseThrow().getId();
        tokens.save(new PasswordResetToken(
                userId, OneTimeToken.hash(token),
                java.time.Instant.now().plus(PasswordResetService.LIFETIME)));
        return token;
    }

    @Test
    void answersIdenticallyWhetherTheAddressExistsOrNot() throws Exception {
        String email = "known-" + System.nanoTime() + "@fuelr.app";
        register(email);

        MvcResult known = mvc.perform(post("/api/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","locale":"fr"}""".formatted(email)))
                .andReturn();

        MvcResult unknown = mvc.perform(post("/api/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"nobody-%d@fuelr.app","locale":"fr"}"""
                                .formatted(System.nanoTime())))
                .andReturn();

        // Same status, same body. Any difference here is an enumeration oracle.
        assertThat(unknown.getResponse().getStatus())
                .isEqualTo(known.getResponse().getStatus());
        assertThat(unknown.getResponse().getContentAsString())
                .isEqualTo(known.getResponse().getContentAsString());
    }

    @Test
    void anUnknownAddressCreatesNoToken() throws Exception {
        long before = tokens.count();
        forgot("ghost-" + System.nanoTime() + "@fuelr.app");
        assertThat(tokens.count()).isEqualTo(before);
    }

    @Test
    void aLinkSetsTheNewPasswordOnce() throws Exception {
        String email = "reset-" + System.nanoTime() + "@fuelr.app";
        register(email);
        String token = requestAndCaptureToken(email);

        mvc.perform(post("/api/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"token":"%s","password":"nouveaumotdepasse"}""".formatted(token)))
                .andExpect(status().isNoContent());

        // The new password works.
        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"nouveaumotdepasse"}""".formatted(email)))
                .andExpect(status().isOk());

        // The old one does not.
        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"motdepasse123"}""".formatted(email)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void aLinkCannotBeReplayed() throws Exception {
        String email = "replay-" + System.nanoTime() + "@fuelr.app";
        register(email);
        String token = requestAndCaptureToken(email);

        mvc.perform(post("/api/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"token":"%s","password":"premiernouveau"}""".formatted(token)))
                .andExpect(status().isNoContent());

        mvc.perform(post("/api/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"token":"%s","password":"secondnouveau"}""".formatted(token)))
                .andExpect(status().isGone());
    }

    @Test
    void anExpiredLinkIsRefused() throws Exception {
        String email = "expired-" + System.nanoTime() + "@fuelr.app";
        register(email);
        Long userId = users.findByEmail(email).orElseThrow().getId();

        String token = "deja-perime-" + System.nanoTime();
        tokens.save(new PasswordResetToken(
                userId, OneTimeToken.hash(token),
                java.time.Instant.now().minusSeconds(60)));

        mvc.perform(post("/api/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"token":"%s","password":"nouveaumotdepasse"}""".formatted(token)))
                .andExpect(status().isGone());
    }

    @Test
    void anInventedTokenIsRefused() throws Exception {
        mvc.perform(post("/api/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"token":"pas-un-vrai-jeton","password":"nouveaumotdepasse"}"""))
                .andExpect(status().isGone());
    }

    @Test
    void resettingSignsEveryDeviceOut() throws Exception {
        String email = "devices-" + System.nanoTime() + "@fuelr.app";
        String phone = register(email);

        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + phone))
                .andExpect(status().isOk());

        String token = requestAndCaptureToken(email);
        mvc.perform(post("/api/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"token":"%s","password":"nouveaumotdepasse"}""".formatted(token)))
                .andExpect(status().isNoContent());

        // Whoever knew the old password is signed out everywhere.
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + phone))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void aShortNewPasswordIsRefused() throws Exception {
        String email = "short-" + System.nanoTime() + "@fuelr.app";
        register(email);
        String token = requestAndCaptureToken(email);

        mvc.perform(post("/api/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"token":"%s","password":"court"}""".formatted(token)))
                .andExpect(status().isBadRequest());
    }
}
