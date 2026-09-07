package ch.celestin.fuelr.account;

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

import java.time.ZonedDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Recommending Fuelr, and the one email somebody may ask for.
 *
 * The referral promises nothing and counts rather than names; the reminder
 * is off until asked for, says what the week actually holds at the moment
 * of sending, and stops from the mail itself.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class ReferralAndReminderTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17");

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired WeeklyReminderJob job;

    private String register(String email, String via) throws Exception {
        String response = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","name":"Chef","password":"motdepasse123","via":%s}"""
                                .formatted(email, via == null ? "null" : "\"" + via + "\"")))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("token").asText();
    }

    @Test
    void theCodeIsMintedOnceAndTheLinkCountsWhoCameByIt() throws Exception {
        String host = register("hote-%d@fuelr.app".formatted(System.nanoTime()), null);

        String first = mvc.perform(get("/api/account/referral").header("Authorization", "Bearer " + host))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.referred").value(0))
                .andReturn().getResponse().getContentAsString();
        String code = json.readTree(first).get("code").asText();
        assertThat(code).hasSize(12);
        assertThat(json.readTree(first).get("link").asText()).endsWith("/?via=" + code);

        // Minted once: the same code next time.
        mvc.perform(get("/api/account/referral").header("Authorization", "Bearer " + host))
                .andExpect(jsonPath("$.code").value(code));

        register("venue-%d@fuelr.app".formatted(System.nanoTime()), code);
        register("venue-%d@fuelr.app".formatted(System.nanoTime()), code);

        // A number, never who.
        String after = mvc.perform(get("/api/account/referral").header("Authorization", "Bearer " + host))
                .andExpect(jsonPath("$.referred").value(2))
                .andReturn().getResponse().getContentAsString();
        assertThat(after).doesNotContain("venue-");
    }

    @Test
    void aCodeNobodyHasNeverStopsARegistration() throws Exception {
        String token = register("seule-%d@fuelr.app".formatted(System.nanoTime()), "PASUNCODE");
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void theReminderIsOffUntilAskedForAndStopsFromTheMail() throws Exception {
        String email = "rappel-%d@fuelr.app".formatted(System.nanoTime());
        String token = register(email, null);

        mvc.perform(get("/api/account/reminder").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.day").doesNotExist());

        mvc.perform(put("/api/account/reminder").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"day":7,"hour":18}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.day").value(7))
                .andExpect(jsonPath("$.hour").value(18));

        // Sunday 18:00 in Zurich: sent, with what the week holds — nothing planned.
        int sent = job.sendFor(ZonedDateTime.of(2026, 3, 8, 18, 0, 0, 0, WeeklyReminderJob.ZONE));
        assertThat(sent).isGreaterThanOrEqualTo(1);
        // Sunday 17:00: not this hour.
        assertThat(job.bodyFor(users.findByEmail(email).orElseThrow(),
                java.time.LocalDate.of(2026, 3, 8))).contains("encore vide");

        // The one-click stop, with no session.
        String stop = users.findByEmail(email).orElseThrow().getReminderToken();
        mvc.perform(post("/api/auth/reminder/unsubscribe")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"token":"%s"}""".formatted(stop)))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/account/reminder").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.day").doesNotExist());
        mvc.perform(post("/api/auth/reminder/unsubscribe")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"token":"pas-un-jeton"}"""))
                .andExpect(status().isGone());
    }

    @Test
    void aDayNobodyHasTurnsTheReminderOff() throws Exception {
        String token = register("jour-%d@fuelr.app".formatted(System.nanoTime()), null);
        mvc.perform(put("/api/account/reminder").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"day":9,"hour":18}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.day").doesNotExist());
    }
}
