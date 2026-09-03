package ch.celestin.fuelr.log;

import ch.celestin.fuelr.ai.AiBudget;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * A plate, photographed and estimated.
 *
 * Against a stand-in for the provider, like every other reading: the suite
 * touches no network, and what is asserted is the part the real one could
 * never guarantee — that an estimate stays an estimate, that a model saying "I
 * cannot tell" is reported as such rather than dressed up as zeroes, and that
 * nothing is written to the diary without somebody agreeing to it.
 */
@SpringBootTest(properties = {
        "app.ai.api-key=test-key",
        "app.ai.price.input-per-million=3.00",
        "app.ai.price.output-per-million=15.00",
        "app.subscription.enforce=false",
        "app.subscription.self-activate=false",
})
@AutoConfigureMockMvc
@Testcontainers
class MealPhotoTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17");

    private static HttpServer server;
    private static String origin;
    private static final AtomicReference<String> ANSWER = new AtomicReference<>();

    private static final byte[] JPEG = new byte[2048];

    static {
        JPEG[0] = (byte) 0xFF;
        JPEG[1] = (byte) 0xD8;
        JPEG[2] = (byte) 0xFF;
        JPEG[3] = (byte) 0xE0;
    }

    @BeforeAll
    static void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/messages", exchange -> {
            exchange.getRequestBody().readAllBytes();
            byte[] body = ANSWER.get().getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        origin = "http://127.0.0.1:" + server.getAddress().getPort();
    }

    @AfterAll
    static void stopServer() {
        server.stop(0);
    }

    @DynamicPropertySource
    static void pointAtTheStandIn(DynamicPropertyRegistry registry) {
        registry.add("app.ai.base-url", () -> origin);
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired AiBudget budget;

    private String token;
    private long userId;

    @BeforeEach
    void signIn() throws Exception {
        ANSWER.set(answer(true, 620));
        String response = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"plate-%d@fuelr.app","name":"Chef","password":"motdepasse123"}"""
                                .formatted(System.nanoTime())))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        token = json.readTree(response).get("token").asText();
        userId = json.readTree(response).get("user").get("id").asLong();
    }

    private static String answer(boolean confident, int kcal) {
        return """
                {"type":"message","content":[{"type":"tool_use","id":"t1",
                  "name":"estimer_le_plat",
                  "input":{"title":"Saumon, riz et brocoli","kcal":%d,"proteinG":38,
                    "carbsG":52,"fatG":18,"confident":%s}}],
                 "usage":{"input_tokens":1600,"output_tokens":120}}"""
                .formatted(kcal, confident);
    }

    private MockMultipartFile photo() {
        return new MockMultipartFile("file", "assiette.jpg", "image/jpeg", JPEG);
    }

    @Test
    void aPlateComesBackAsFiguresToLookAtRatherThanARow() throws Exception {
        mvc.perform(multipart("/api/log/estimate")
                        .file(photo())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Saumon, riz et brocoli"))
                .andExpect(jsonPath("$.kcal").value(620.0));

        // Nothing was written: what lands in the diary is what somebody looked
        // at and accepted.
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/log")
                        .header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.entries.length()").value(0));
    }

    @Test
    void whatIsLoggedFromAnEstimateSaysItIsOne() throws Exception {
        // The figures go through the ordinary free-entry path, which marks
        // everything typed as estimated — a camera does not change that.
        mvc.perform(post("/api/log")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"date":"%s","slot":"DINNER","title":"Saumon, riz et brocoli",
                                 "kcal":620,"proteinG":38}"""
                                .formatted(java.time.LocalDate.now())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.estimated").value(true));
    }

    @Test
    void aModelThatCannotTellSaysSoRatherThanInventingZeroes() throws Exception {
        ANSWER.set(answer(false, 0));

        // 422: it looked and could not tell. That is an answer about the
        // photo, not a fault of ours, and not a figure of any kind.
        mvc.perform(multipart("/api/log/estimate")
                        .file(photo())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void theReadingIsBilledFromTheTokensTheProviderCounted() throws Exception {
        mvc.perform(multipart("/api/log/estimate")
                        .file(photo())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        // 1600 in at $3/M and 120 out at $15/M — 6 600 micro-dollars.
        assertThat(budget.spentMicros(userId)).isEqualTo(6_600L);
    }

    @Test
    void whatIsNotAnImageIsRefusedHoweverItIsAnnounced() throws Exception {
        MockMultipartFile lying = new MockMultipartFile(
                "file", "assiette.jpg", "image/jpeg", "<html>nope</html>".getBytes());

        mvc.perform(multipart("/api/log/estimate")
                        .file(lying)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnsupportedMediaType());
    }

    @Test
    void estimatingNeedsASession() throws Exception {
        mvc.perform(multipart("/api/log/estimate").file(photo()))
                .andExpect(status().isUnauthorized());
    }
}
