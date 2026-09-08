package ch.celestin.fuelr.recipe.illustration;

import ch.celestin.fuelr.ai.AiUsageRepository;
import com.fasterxml.jackson.databind.JsonNode;
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
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * A proposed dish is drawn while it is still a proposal, and keeping it
 * opens a draft that already has its photo.
 *
 * Two stand-ins: a model answering two dishes in one piece, and an image
 * provider answering a pixel. What is checked is what the screen lives on:
 * the proposal carries a key, the key answers a picture within seconds,
 * keeping the dish hands the picture to the draft at once, and the month
 * is charged once per dish — never again at keeping time.
 */
@SpringBootTest(properties = {
        "app.subscription.enforce=false",
        "app.subscription.self-activate=false",
        "app.ai.api-key=stand-in",
        "app.ai.illustration.token=stand-in",
        "app.ai.illustration.price-micros=3000",
})
@AutoConfigureMockMvc
@Testcontainers
class IdeaIllustrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17");

    private static final String PIXEL =
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

    private static HttpServer server;
    private static String origin;
    private static final AtomicInteger DRAWN = new AtomicInteger();

    @BeforeAll
    static void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/messages", exchange -> {
            exchange.getRequestBody().readAllBytes();
            byte[] body = """
                    {"type":"message","content":[{"type":"tool_use","id":"t1","name":"proposer_des_plats",
                      "input":{"plats":[
                        {"titre":"Dahl de lentilles corail","minutes":25,"manque":[],
                         "ingredients":[{"nom":"Lentilles corail","quantite":300,"unite":"g"}],"etapes":["Cuire."]},
                        {"titre":"Soupe de courge","minutes":30,"manque":[],
                         "ingredients":[{"nom":"Courge","quantite":500,"unite":"g"}],"etapes":["Mixer."]}]}}],
                     "usage":{"input_tokens":800,"output_tokens":300}}""".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.createContext("/nscale/v1/images/generations", exchange -> {
            exchange.getRequestBody().readAllBytes();
            DRAWN.incrementAndGet();
            byte[] body = ("{\"data\":[{\"b64_json\":\"" + PIXEL + "\"}]}").getBytes(StandardCharsets.UTF_8);
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
    static void pointAtTheStandIns(DynamicPropertyRegistry registry) {
        registry.add("app.ai.base-url", () -> origin);
        registry.add("app.ai.illustration.base-url", () -> origin);
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired AiUsageRepository usage;

    private String token;
    private long userId;

    @BeforeEach
    void signIn() throws Exception {
        DRAWN.set(0);
        String response = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"idee-%d@fuelr.app","name":"Chef","password":"motdepasse123"}"""
                                .formatted(System.nanoTime())))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        token = json.readTree(response).get("token").asText();
        userId = json.readTree(response).get("user").get("id").asLong();
    }

    private int pictureStatus(String key) throws Exception {
        return mvc.perform(get("/api/ideas/illustrations/" + key)
                        .header("Authorization", "Bearer " + token))
                .andReturn().getResponse().getStatus();
    }

    private void awaitPicture(String key) throws Exception {
        for (int tries = 0; tries < 50 && pictureStatus(key) != 200; tries++) {
            Thread.sleep(200);
        }
    }

    @Test
    void aProposedDishIsDrawnBeforeItIsKeptAndKeepingItHandsThePictureOver() throws Exception {
        String answer = mvc.perform(post("/api/plan/suggest")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"week":"2026-03-02"}"""))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode first = json.readTree(answer).path("proposals").path(0);
        String key = first.path("illustrationKey").asText(null);
        assertThat(key).isNotBlank();
        assertThat(key).isEqualTo(IllustrationService.keyOf("  dahl DE lentilles corail "));

        // Drawn while the answer was being written; on screen within seconds.
        awaitPicture(key);
        assertThat(pictureStatus(key)).isEqualTo(200);

        // Kept: the draft opens with its photo, and nothing is drawn again.
        int drawnBefore = DRAWN.get();
        String created = mvc.perform(post("/api/recipes/from-idea")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Dahl de lentilles corail","minutes":25,
                                 "ingredients":[{"name":"Lentilles corail","quantity":300,"unit":"g"}],
                                 "steps":["Cuire."]}"""))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        JsonNode view = json.readTree(created);
        assertThat(view.path("hasPhoto").asBoolean()).isTrue();
        assertThat(view.path("photoGenerated").asBoolean()).isTrue();
        Thread.sleep(800);
        assertThat(DRAWN.get()).isEqualTo(drawnBefore);
        // The picture changed hands: it is the recipe's now, not a proposal's.
        assertThat(pictureStatus(key)).isEqualTo(404);

        // Two dishes, two pictures, two charges — and not a third for keeping one.
        assertThat(usage.findAll().stream()
                .filter(row -> row.getUserId().equals(userId) && "ILLUSTRATION".equals(row.getOperation())))
                .hasSize(2);
    }

    @Test
    void aPictureIsOnlyShownToTheAccountItWasDrawnFor() throws Exception {
        mvc.perform(post("/api/plan/suggest")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"week":"2026-03-02"}"""))
                .andExpect(status().isOk());
        String key = IllustrationService.keyOf("Soupe de courge");
        awaitPicture(key);
        assertThat(pictureStatus(key)).isEqualTo(200);

        String other = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"autre-%d@fuelr.app","name":"Autre","password":"motdepasse123"}"""
                                .formatted(System.nanoTime())))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String otherToken = json.readTree(other).get("token").asText();
        mvc.perform(get("/api/ideas/illustrations/" + key)
                        .header("Authorization", "Bearer " + otherToken))
                .andExpect(status().isNotFound());
    }
}
