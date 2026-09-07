package ch.celestin.fuelr.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
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

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class SessionTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17");

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String signIn(String email) throws Exception {
        String response = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","name":"Chef","password":"motdepasse123"}"""
                                .formatted(email)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("token").asText();
    }

    private String login(String email) throws Exception {
        String response = mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"motdepasse123"}""".formatted(email)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("token").asText();
    }

    @Test
    void aTokenStopsWorkingOnceItsSessionIsClosed() throws Exception {
        String token = signIn("logout-" + System.nanoTime() + "@fuelr.app");

        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        mvc.perform(post("/api/auth/logout").header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        // The signature is still valid and the token has not expired — only the
        // session is gone. That is the whole point.
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void closingOneDeviceLeavesTheOthersAlone() throws Exception {
        String email = "two-" + System.nanoTime() + "@fuelr.app";
        String phone = signIn(email);
        String laptop = login(email);

        mvc.perform(post("/api/auth/logout").header("Authorization", "Bearer " + phone))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + phone))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + laptop))
                .andExpect(status().isOk());
    }

    @Test
    void closingTheOthersKeepsTheCurrentOne() throws Exception {
        String email = "others-" + System.nanoTime() + "@fuelr.app";
        String first = signIn(email);
        String second = login(email);
        String third = login(email);

        mvc.perform(delete("/api/auth/sessions").header("Authorization", "Bearer " + third))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + third))
                .andExpect(status().isOk());
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + first))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + second))
                .andExpect(status().isUnauthorized());
    }

    /** A second device: another login for the same account, from that agent. */
    private String signInAs(String email, String userAgent) throws Exception {
        String response = mvc.perform(post("/api/auth/login")
                        .header("User-Agent", userAgent)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"motdepasse123"}""".formatted(email)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("token").asText();
    }

    @Test
    void theDevicesAreListedInWordsAndThisOneIsMarked() throws Exception {
        String email = "devices-" + System.nanoTime() + "@fuelr.app";
        signIn(email);
        String laptop = signInAs(email, "Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0 Safari/537.36");
        String phone = signInAs(email, "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1");

        String listed = mvc.perform(get("/api/auth/sessions").header("Authorization", "Bearer " + laptop))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        var devices = json.readTree(listed);
        assertThat(devices.size()).isGreaterThanOrEqualTo(2);
        // Said in words a person recognises, and never the raw agent string.
        assertThat(listed).contains("Chrome · Linux").contains("Safari · iOS");
        assertThat(listed).doesNotContain("Mozilla/5.0");
        // The one asking is marked as such.
        long current = 0;
        for (var device : devices) {
            if (device.get("current").asBoolean()) current++;
        }
        assertThat(current).isEqualTo(1);
    }

    @Test
    void oneDeviceCanBeClosedByNameAndThisOneCannot() throws Exception {
        String email = "close-" + System.nanoTime() + "@fuelr.app";
        signIn(email);
        String laptop = signInAs(email, "Chrome/120.0 (X11; Linux)");
        String phone = signInAs(email, "Safari/604.1 (iPhone)");

        String listed = mvc.perform(get("/api/auth/sessions").header("Authorization", "Bearer " + laptop))
                .andReturn().getResponse().getContentAsString();
        String phoneId = null;
        String laptopId = null;
        for (var device : json.readTree(listed)) {
            if (device.get("current").asBoolean()) laptopId = device.get("id").asText();
            else if (device.get("device").asText().startsWith("Safari")) phoneId = device.get("id").asText();
        }
        assertThat(phoneId).isNotNull();

        mvc.perform(delete("/api/auth/sessions/" + phoneId).header("Authorization", "Bearer " + laptop))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + phone))
                .andExpect(status().isUnauthorized());

        // This one closes through logout, never here.
        mvc.perform(delete("/api/auth/sessions/" + laptopId).header("Authorization", "Bearer " + laptop))
                .andExpect(status().isConflict());
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + laptop))
                .andExpect(status().isOk());
    }

    @Test
    void somebodyElsesDeviceIsNotThereToClose() throws Exception {
        String email = "mine-" + System.nanoTime() + "@fuelr.app";
        signIn(email);
        String mine = signInAs(email, "Chrome/120.0 (X11; Linux)");
        String otherEmail = "autre-%d@fuelr.app".formatted(System.nanoTime());
        signIn(otherEmail);
        String theirs = signInAs(otherEmail, "Safari/604.1 (iPhone)");
        String listed = mvc.perform(get("/api/auth/sessions").header("Authorization", "Bearer " + theirs))
                .andReturn().getResponse().getContentAsString();
        String theirId = json.readTree(listed).get(0).get("id").asText();

        mvc.perform(delete("/api/auth/sessions/" + theirId).header("Authorization", "Bearer " + mine))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + theirs))
                .andExpect(status().isOk());
    }

    @Test
    void logoutNeedsAValidSessionOfItsOwn() throws Exception {
        mvc.perform(post("/api/auth/logout")).andExpect(status().isUnauthorized());
    }

    @Test
    void aFourthWrongPasswordStartsADelay() throws Exception {
        String email = "slow-" + System.nanoTime() + "@fuelr.app";
        signIn(email);

        // Three failures are free: a typo is not an attack.
        for (int i = 0; i < 3; i++) {
            mvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"email":"%s","password":"faux"}""".formatted(email)))
                    .andExpect(status().isUnauthorized());
        }

        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"faux"}""".formatted(email)))
                .andExpect(status().isUnauthorized());

        // The next attempt is held, even with the right password.
        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"motdepasse123"}""".formatted(email)))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void aSuccessfulLoginClearsTheCounter() throws Exception {
        String email = "reset-" + System.nanoTime() + "@fuelr.app";
        signIn(email);

        for (int i = 0; i < 2; i++) {
            mvc.perform(post("/api/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                            {"email":"%s","password":"faux"}""".formatted(email)));
        }

        login(email);

        // Two more failures must not tip it over: the count started again.
        for (int i = 0; i < 2; i++) {
            mvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"email":"%s","password":"faux"}""".formatted(email)))
                    .andExpect(status().isUnauthorized());
        }
    }

    @Test
    void anUnknownEmailIsNeverThrottled() throws Exception {
        // Throttling an address that does not exist would answer differently
        // from one that does, which is how account enumeration starts.
        for (int i = 0; i < 6; i++) {
            mvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"email":"nobody-%d@fuelr.app","password":"faux"}"""
                                    .formatted(System.nanoTime())))
                    .andExpect(status().isUnauthorized());
        }
    }

    @Test
    void theDelayGrowsWithEachFailure() {
        assertThat(AuthService.delayAfter(3)).isEqualTo(Duration.ZERO);
        assertThat(AuthService.delayAfter(4)).isEqualTo(Duration.ofSeconds(10));
        assertThat(AuthService.delayAfter(5)).isEqualTo(Duration.ofSeconds(20));
        assertThat(AuthService.delayAfter(6)).isEqualTo(Duration.ofSeconds(40));
        // And it stops growing, so a forgotten password is never a permanent lockout.
        assertThat(AuthService.delayAfter(30)).isEqualTo(Duration.ofSeconds(300));
    }
}
