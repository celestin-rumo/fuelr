package ch.celestin.fuelr.subscription;

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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * What the app does while nothing is charged.
 *
 * This is the production default, and the rest of the suite runs with the
 * boundary on — so between the two, both halves of the switch are described.
 * Everything here is one flag: `app.subscription.enforce`, off.
 */
@SpringBootTest(properties = {
        "app.subscription.enforce=false",
        // Nothing may be granted here either: the point is that a plain
        // account, having ordered nothing, can use everything.
        "app.subscription.self-activate=false",
})
@AutoConfigureMockMvc
@Testcontainers
class LaunchPeriodTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17");

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired Entitlements entitlements;
    @Autowired ch.celestin.fuelr.ai.AiBudget budget;

    private String token;
    private long userId;

    @BeforeEach
    void signIn() throws Exception {
        String response = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"launch-%d@fuelr.app","name":"Chef","password":"motdepasse123"}"""
                                .formatted(System.nanoTime())))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        token = json.readTree(response).get("token").asText();
        userId = json.readTree(response).get("user").get("id").asLong();
    }

    @Test
    void everyFeatureIsOpenToAnAccountThatPaidNothing() {
        // Still FREE — nothing was bought, and nothing pretends otherwise.
        assertThat(entitlements.tierOf(userId)).isEqualTo(Tier.FREE);
        for (Feature feature : Feature.values()) {
            assertThat(entitlements.has(userId, feature))
                    .as("%s during the launch period", feature)
                    .isTrue();
        }
    }

    @Test
    void aMeteredFeatureIsCappedInMoneyRatherThanHeldBack() {
        // Reading a photo is billed to us per call, and it is open anyway:
        // holding it back protected no margin while nobody can subscribe, it
        // only made the feature unreachable. What bounds it is a ceiling.
        assertThat(Feature.AI_IMPORT.metered()).isTrue();
        assertThat(entitlements.has(userId, Feature.AI_IMPORT)).isTrue();
        assertThat(budget.budgetMicros(userId))
                .as("an account with no plan can still spend something")
                .isPositive();
    }

    @Test
    void theTargetBesideTheDiaryIsNotRefused() throws Exception {
        // The clearest 402 in the app, and it does not happen here.
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .put("/api/log/targets")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"kcal":2000,"proteinG":100,"carbsG":250,"fatG":70}"""))
                .andExpect(status().isOk());

        mvc.perform(get("/api/log").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.tracking").value(true))
                .andExpect(jsonPath("$.targets.chosen").value(true));
    }

    @Test
    void theAccountIsToldItIsAnOpenPeriodRatherThanLeftToGuess() throws Exception {
        mvc.perform(get("/api/subscription").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tier").value("FREE"))
                .andExpect(jsonPath("$.openPeriod").value(true))
                // Every feature is usable, so every feature is listed: the
                // screens ask what they may do, never what tier this is.
                .andExpect(jsonPath("$.features.length()").value(Feature.values().length))
                // And nothing can be bought, which the screen says out loud.
                .andExpect(jsonPath("$.canOrder").value(false));
    }

    @Test
    void thePricingPageIsToldTheSameThing() throws Exception {
        mvc.perform(get("/api/plans"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.openPeriod").value(true));
    }
}
