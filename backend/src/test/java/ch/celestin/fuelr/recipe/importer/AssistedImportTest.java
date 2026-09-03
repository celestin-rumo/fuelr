package ch.celestin.fuelr.recipe.importer;

import ch.celestin.fuelr.subscription.Entitlements;
import ch.celestin.fuelr.subscription.Feature;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Importing from a photo or a screenshot, while nothing can read one yet.
 *
 * Everything here is about refusing well: which refusal, in which order, and
 * said before somebody has chosen their photos rather than after.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class AssistedImportTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17");

    /** A real JPEG's signature — the bytes are what gets checked. */
    private static final byte[] JPEG = new byte[2048];

    static {
        JPEG[0] = (byte) 0xFF;
        JPEG[1] = (byte) 0xD8;
        JPEG[2] = (byte) 0xFF;
        JPEG[3] = (byte) 0xE0;
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired Entitlements entitlements;

    private String token;
    private long userId;

    @BeforeEach
    void signIn() throws Exception {
        String response = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"ai-%d@fuelr.app","name":"Chef","password":"motdepasse123"}"""
                                .formatted(System.nanoTime())))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        token = json.readTree(response).get("token").asText();
        userId = json.readTree(response).get("user").get("id").asLong();
    }

    private void subscribe() throws Exception {
        mvc.perform(post("/api/subscription/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"tier":"PLUS"}"""))
                .andExpect(status().isAccepted());
    }

    private MockMultipartFile file() {
        return new MockMultipartFile("files", "page.jpg", "image/jpeg", JPEG);
    }

    // --- what the screen is told --------------------------------------------

    @Test
    void aLinkIsAlwaysOpenAndTheOtherTwoNameTheirPlan() throws Exception {
        mvc.perform(get("/api/recipes/import/sources")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.source == 'URL')].state")
                        .value(org.hamcrest.Matchers.contains("OPEN")))
                .andExpect(jsonPath("$[?(@.source == 'PHOTO')].state")
                        .value(org.hamcrest.Matchers.contains("PLAN")))
                .andExpect(jsonPath("$[?(@.source == 'PHOTO')].requiredTier")
                        .value(org.hamcrest.Matchers.contains("PLUS")));
    }

    @Test
    void withThePlanTheAnswerBecomesNotWiredYetRatherThanNotYours() throws Exception {
        subscribe();

        // Two different conversations: subscribing answers the first, and only
        // we can answer the second.
        mvc.perform(get("/api/recipes/import/sources")
                        .header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$[?(@.source == 'SCREENSHOT')].state")
                        .value(org.hamcrest.Matchers.contains("SOON")));
    }

    // --- the boundary -------------------------------------------------------

    @Test
    void readingWithAModelIsAMeteredFeature() {
        // Which is what keeps it closed during the launch period, where every
        // other feature is open — LaunchPeriodTest asserts that half.
        assertThat(Feature.AI_IMPORT.metered()).isTrue();
        assertThat(entitlements.has(userId, Feature.AI_IMPORT)).isFalse();
    }

    @Test
    void withoutThePlanAPhotoImportIsRefusedAsPayment() throws Exception {
        mvc.perform(multipart("/api/recipes/import/photos")
                        .file(file())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isPaymentRequired())
                .andExpect(jsonPath("$.feature").value("AI_IMPORT"))
                .andExpect(jsonPath("$.requiredTier").value("PLUS"));
    }

    @Test
    void withThePlanItSaysNothingIsWiredRatherThanFailing() throws Exception {
        subscribe();

        // 503, not 500: nothing is broken, nothing is configured.
        mvc.perform(multipart("/api/recipes/import/photos")
                        .file(file())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isServiceUnavailable());
    }

    // --- what is sent -------------------------------------------------------

    @Test
    void whatIsNotAnImageIsRefusedHoweverItIsAnnounced() throws Exception {
        subscribe();

        MockMultipartFile lying = new MockMultipartFile(
                "files", "page.jpg", "image/jpeg", "<html>Connectez-vous</html>".getBytes());
        mvc.perform(multipart("/api/recipes/import/photos")
                        .file(lying)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnsupportedMediaType());
    }

    @Test
    void anUnknownKindOfSourceIsRefused() throws Exception {
        subscribe();

        mvc.perform(multipart("/api/recipes/import/photos")
                        .file(file())
                        .param("source", "TELEPATHIE")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());
    }

    @Test
    void importingFromAPhotoNeedsASession() throws Exception {
        mvc.perform(multipart("/api/recipes/import/photos").file(file()))
                .andExpect(status().isUnauthorized());
    }
}
