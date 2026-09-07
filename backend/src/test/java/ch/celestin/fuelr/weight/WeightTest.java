package ch.celestin.fuelr.weight;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Weigh-ins. Most of what matters is what does not happen: a weigh-in does
 * not move the profile, and the profile is what the target is computed from.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class WeightTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17");

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String token;

    @BeforeEach
    void signIn() throws Exception {
        token = register("poids");
    }

    private String register(String prefix) throws Exception {
        String response = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s-%d@fuelr.app","name":"Chef","password":"motdepasse123"}"""
                                .formatted(prefix, System.nanoTime())))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("token").asText();
    }

    private void weigh(String day, double kg) throws Exception {
        mvc.perform(post("/api/weight")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"weighedOn":"%s","weightKg":%s}""".formatted(day, kg)))
                .andExpect(status().isOk());
    }

    private long firstEntryId() throws Exception {
        String listed = mvc.perform(get("/api/weight").param("from", "2026-03-01")
                        .param("to", "2026-03-31").header("Authorization", "Bearer " + token))
                .andReturn().getResponse().getContentAsString();
        return json.readTree(listed).get("entries").get(0).get("id").asLong();
    }

    @Test
    void oneFigureADayAndTheLatestOfAll() throws Exception {
        weigh("2026-03-02", 62.4);
        weigh("2026-03-09", 62.0);
        // Weighed twice on the ninth: the second replaces the first.
        weigh("2026-03-09", 61.8);

        mvc.perform(get("/api/weight").param("from", "2026-03-01").param("to", "2026-03-31")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries.length()").value(2))
                .andExpect(jsonPath("$.entries[1].weightKg").value(61.8))
                .andExpect(jsonPath("$.latest.weighedOn").value("2026-03-09"));
    }

    @Test
    void aWeighInNeverMovesTheProfile() throws Exception {
        mvc.perform(put("/api/profile")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"age":34,"sex":"FEMALE","heightCm":168,"weightKg":62,
                                 "activity":"MODERATE","goal":"MAINTAIN"}"""))
                .andExpect(status().isOk());

        weigh("2026-03-09", 58.0);

        // The target is computed from the profile, and the profile has not
        // moved: a weigh-in proposes a recalculation, it never applies one.
        mvc.perform(get("/api/weight").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.profileWeightKg").value(62.0))
                .andExpect(jsonPath("$.latest.weightKg").value(58.0));
        mvc.perform(get("/api/profile").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.profile.weightKg").value(62.0));
    }

    @Test
    void aWeighInIsRemovedWithoutCeremony() throws Exception {
        weigh("2026-03-02", 62.4);
        long id = firstEntryId();

        mvc.perform(delete("/api/weight/" + id).header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/weight").param("from", "2026-03-01").param("to", "2026-03-31")
                        .header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.entries.length()").value(0))
                .andExpect(jsonPath("$.latest").doesNotExist());
    }

    @Test
    void somebodyElsesWeighInIsNotThereToRemove() throws Exception {
        weigh("2026-03-02", 62.4);
        long id = firstEntryId();
        String other = register("autre");

        mvc.perform(delete("/api/weight/" + id).header("Authorization", "Bearer " + other))
                .andExpect(status().isNotFound());
    }

    @Test
    void aWeightOutsideAnyHumanRangeIsRefused() throws Exception {
        mvc.perform(post("/api/weight")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"weighedOn":"2026-03-02","weightKg":7}"""))
                .andExpect(status().isBadRequest());
    }

    @Test
    void weighingNeedsASession() throws Exception {
        mvc.perform(get("/api/weight")).andExpect(status().isUnauthorized());
    }
}
