package ch.celestin.fuelr.profile;

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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class ProfileApiTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17");

    private static final String PROFILE = """
            {"age":30,"sex":"MALE","heightCm":175,"weightKg":70,
             "activity":"MODERATE","goal":"MAINTAIN"}""";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String signIn() throws Exception {
        String response = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"profile-%d@fuelr.app","name":"Chef","password":"motdepasse123"}"""
                                .formatted(System.nanoTime())))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("token").asText();
    }

    @Test
    void thePreviewNeedsNoAccount() throws Exception {
        // The whole point of the onboarding: numbers before the sign-up wall.
        mvc.perform(post("/api/nutrition/target")
                        .contentType(MediaType.APPLICATION_JSON).content(PROFILE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kcal").isNumber())
                .andExpect(jsonPath("$.proteinG").isNumber());
    }

    @Test
    void thePreviewStillRefusesNonsense() throws Exception {
        mvc.perform(post("/api/nutrition/target")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"age":30,"sex":"MALE","heightCm":17,"weightKg":70,
                                 "activity":"MODERATE","goal":"MAINTAIN"}"""))
                .andExpect(status().isBadRequest());
    }

    @Test
    void aProfileIsSavedAndReadBackWithItsTargets() throws Exception {
        String token = signIn();

        mvc.perform(put("/api/profile").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content(PROFILE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.targets.kcal").isNumber());

        mvc.perform(get("/api/profile").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile.heightCm").value(175))
                .andExpect(jsonPath("$.profile.goal").value("MAINTAIN"));
    }

    @Test
    void savingTwiceReplacesTheProfileRatherThanAddingASecond() throws Exception {
        String token = signIn();

        mvc.perform(put("/api/profile").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content(PROFILE))
                .andExpect(status().isOk());

        mvc.perform(put("/api/profile").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"age":31,"sex":"MALE","heightCm":175,"weightKg":72,
                                 "activity":"ACTIVE","goal":"GAIN"}"""))
                .andExpect(status().isOk());

        mvc.perform(get("/api/profile").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile.age").value(31))
                .andExpect(jsonPath("$.profile.goal").value("GAIN"));
    }

    @Test
    void anAccountWithNoProfileSaysSo() throws Exception {
        mvc.perform(get("/api/profile").header("Authorization", "Bearer " + signIn()))
                .andExpect(status().isNotFound());
    }

    @Test
    void aProfileBelongsToItsAccountOnly() throws Exception {
        String mine = signIn();
        mvc.perform(put("/api/profile").header("Authorization", "Bearer " + mine)
                        .contentType(MediaType.APPLICATION_JSON).content(PROFILE))
                .andExpect(status().isOk());

        // Someone else's session never sees it.
        mvc.perform(get("/api/profile").header("Authorization", "Bearer " + signIn()))
                .andExpect(status().isNotFound());
    }

    @Test
    void savingAProfileNeedsASession() throws Exception {
        mvc.perform(put("/api/profile")
                        .contentType(MediaType.APPLICATION_JSON).content(PROFILE))
                .andExpect(status().isUnauthorized());
    }
}
