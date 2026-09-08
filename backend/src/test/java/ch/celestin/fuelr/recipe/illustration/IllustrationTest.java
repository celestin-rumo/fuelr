package ch.celestin.fuelr.recipe.illustration;

import ch.celestin.fuelr.ai.AiUsageRepository;
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
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * A dish a model wrote gets a picture, after the answer.
 *
 * The stand-in speaks the shape the provider does — the picture as base64
 * inside JSON — and what is checked is what the screen will see: the recipe
 * answers first without a photo, then with one that says it was generated;
 * the month is charged once; and a provider that fails leaves a recipe
 * without a picture and a month without a charge.
 */
@SpringBootTest(properties = {
        "app.subscription.enforce=false",
        "app.subscription.self-activate=false",
        "app.ai.illustration.token=stand-in",
        "app.ai.illustration.price-micros=3000",
})
@AutoConfigureMockMvc
@Testcontainers
class IllustrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17");

    /** A one-pixel PNG: enough to be sniffed as one. */
    private static final String PIXEL =
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

    private static HttpServer server;
    private static String origin;
    private static final AtomicInteger STATUS = new AtomicInteger(200);
    private static final AtomicInteger CALLS = new AtomicInteger();
    private static final AtomicReference<String> ASKED = new AtomicReference<>();

    @BeforeAll
    static void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/nscale/v1/images/generations", exchange -> {
            CALLS.incrementAndGet();
            ASKED.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] body = ("{\"data\":[{\"b64_json\":\"" + PIXEL + "\"}]}").getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(STATUS.get(), body.length);
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
        registry.add("app.ai.illustration.base-url", () -> origin);
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired AiUsageRepository usage;

    private String token;
    private long userId;

    @BeforeEach
    void signIn() throws Exception {
        STATUS.set(200);
        CALLS.set(0);
        String response = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"illustre-%d@fuelr.app","name":"Chef","password":"motdepasse123"}"""
                                .formatted(System.nanoTime())))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        token = json.readTree(response).get("token").asText();
        userId = json.readTree(response).get("user").get("id").asLong();
    }

    private long fromIdea() throws Exception {
        String created = mvc.perform(post("/api/recipes/from-idea")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Dahl de lentilles corail","minutes":25,
                                 "ingredients":[{"name":"Lentilles corail","quantity":300,"unit":"g"},
                                                {"name":"Lait de coco","quantity":400,"unit":"ml"}],
                                 "steps":["Cuire 20 min."]}"""))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        // Answered at once, and without a picture yet.
        assertThat(json.readTree(created).path("hasPhoto").asBoolean()).isFalse();
        return json.readTree(created).get("id").asLong();
    }

    private com.fasterxml.jackson.databind.JsonNode recipe(long id) throws Exception {
        return json.readTree(mvc.perform(get("/api/recipes/" + id)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }

    private com.fasterxml.jackson.databind.JsonNode awaitPhoto(long id) throws Exception {
        for (int tries = 0; tries < 50; tries++) {
            com.fasterxml.jackson.databind.JsonNode view = recipe(id);
            if (view.path("hasPhoto").asBoolean()) {
                return view;
            }
            Thread.sleep(200);
        }
        return recipe(id);
    }

    @Test
    void aDishAModelWroteGetsAPictureThatSaysWhatItIs() throws Exception {
        long id = fromIdea();

        com.fasterxml.jackson.databind.JsonNode view = awaitPhoto(id);
        assertThat(view.path("hasPhoto").asBoolean()).isTrue();
        // Confessed: a picture an image model drew is not a photograph of a dish somebody cooked.
        assertThat(view.path("photoGenerated").asBoolean()).isTrue();

        // Made from the dish and nothing about the person.
        assertThat(ASKED.get()).contains("Dahl de lentilles corail").contains("Lentilles corail")
                .contains("black-forest-labs/FLUX.1-schnell").doesNotContain("illustre-");

        // Charged once, at the picture's price.
        assertThat(usage.findAll().stream()
                .filter(row -> row.getUserId().equals(userId) && "ILLUSTRATION".equals(row.getOperation())))
                .hasSize(1)
                .allSatisfy(row -> assertThat(row.getCostMicros()).isEqualTo(3000));
    }

    @Test
    void aProviderThatFailsLeavesTheRecipeWithoutAPictureAndTheMonthUncharged() throws Exception {
        STATUS.set(500);
        long id = fromIdea();

        Thread.sleep(1500);
        assertThat(CALLS.get()).isGreaterThan(0);
        assertThat(recipe(id).path("hasPhoto").asBoolean()).isFalse();
        assertThat(usage.findAll().stream()
                .filter(row -> row.getUserId().equals(userId) && "ILLUSTRATION".equals(row.getOperation())))
                .isEmpty();
    }
}
