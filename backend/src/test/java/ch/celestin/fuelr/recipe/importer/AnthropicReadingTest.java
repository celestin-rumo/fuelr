package ch.celestin.fuelr.recipe.importer;

import ch.celestin.fuelr.ai.AiBudget;
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
 * Reading a photo, against a stand-in for the provider.
 *
 * The suite touches no network anywhere, and this is no exception: a local
 * server answers in the provider's shape, which is what makes it possible to
 * assert the two things that matter and could not be asserted against the real
 * one — that what comes back is turned into a draft with its guesses flagged,
 * and that the tokens it reports are what gets billed to the account.
 */
@SpringBootTest(properties = {
        "app.ai.api-key=test-key",
        "app.ai.price.input-per-million=3.00",
        "app.ai.price.output-per-million=15.00",
        // One cent a month, so the ceiling is reachable in one read.
        "app.ai.budget.launch-cents=1",
        // Out of the way here; it has a test of its own below.
        "app.ai.budget.total-cents=100000",
        // The shipped configuration: nothing is charged, so a plain account
        // that ordered nothing can read a photo. What bounds it is the
        // ceiling above, not a plan — AssistedImportTest covers the other
        // half, with the boundary switched on.
        "app.subscription.enforce=false",
        "app.subscription.self-activate=false",
        // The same server hands out the captured pages, so an import can be
        // exercised end to end without leaving this machine.
        "app.import.allow-private-hosts=true",
})
@AutoConfigureMockMvc
@Testcontainers
class AnthropicReadingTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17");

    private static HttpServer server;
    private static String origin;

    /** What the stand-in answers next, and what it was last asked. */
    private static final AtomicReference<String> ANSWER = new AtomicReference<>();
    private static final AtomicReference<String> ASKED = new AtomicReference<>();
    private static final AtomicReference<Integer> STATUS = new AtomicReference<>(200);

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
        // The pages an import reads, served from the same place as the model's
        // stand-in: two roles, one server, and no network either way.
        server.createContext("/blog-sans-donnees.html", exchange -> fixture(exchange));
        server.createContext("/marmiton.html", exchange -> fixture(exchange));

        server.createContext("/v1/messages", exchange -> {
            ASKED.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] body = ANSWER.get().getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(STATUS.get(), body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        origin = "http://127.0.0.1:" + server.getAddress().getPort();
    }

    private static void fixture(com.sun.net.httpserver.HttpExchange exchange)
            throws IOException {
        String name = exchange.getRequestURI().getPath().substring(1);
        byte[] body;
        try (var stream = AnthropicReadingTest.class.getResourceAsStream("/import/" + name)) {
            body = stream == null ? null : stream.readAllBytes();
        }
        if (body == null) {
            exchange.sendResponseHeaders(404, -1);
            exchange.close();
            return;
        }
        exchange.getResponseHeaders().add("Content-Type", "text/html; charset=utf-8");
        exchange.sendResponseHeaders(200, body.length);
        exchange.getResponseBody().write(body);
        exchange.close();
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
    @Autowired AiUsageRepository usage;

    private String token;
    private long userId;

    @BeforeEach
    void signIn() throws Exception {
        STATUS.set(200);
        ANSWER.set(answer(2000, 300));
        String response = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"read-%d@fuelr.app","name":"Chef","password":"motdepasse123"}"""
                                .formatted(System.nanoTime())))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        token = json.readTree(response).get("token").asText();
        userId = json.readTree(response).get("user").get("id").asLong();
    }

    /** The provider's shape: one tool call, and the tokens it counted. */
    private static String answer(int inputTokens, int outputTokens) {
        return """
                {"type":"message","role":"assistant","model":"claude-sonnet-5",
                 "content":[{"type":"tool_use","id":"toolu_1","name":"enregistrer_recette",
                   "input":{"title":"Tarte aux pommes","description":"Une tarte simple.",
                     "servings":6,"totalMinutes":60,
                     "ingredients":[
                       {"name":"Pommes","quantity":4,"unit":"piece","needsReview":false},
                       {"name":"Farine","quantity":200,"unit":"g","needsReview":false},
                       {"name":"une pincée de sel","quantity":0,"unit":"","needsReview":true}],
                     "tags":["vegetarian","soupe"],
                     "steps":["Éplucher les pommes.","Cuire 40 min à 180 °C."]}}],
                 "usage":{"input_tokens":%d,"output_tokens":%d}}"""
                .formatted(inputTokens, outputTokens);
    }

    private long importOne() throws Exception {
        String created = mvc.perform(multipart("/api/recipes/import/photos")
                        .file(new MockMultipartFile("files", "page.jpg", "image/jpeg", JPEG))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(created).get("id").asLong();
    }

    @Test
    void aPhotoBecomesADraftWithItsGuessesMarked() throws Exception {
        long id = importOne();

        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/recipes/" + id)
                        .header("Authorization", "Bearer " + token))
                // Never published: what a model read is a starting point.
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.title").value("Tarte aux pommes"))
                .andExpect(jsonPath("$.servings").value(6))
                .andExpect(jsonPath("$.steps.length()").value(2))
                // The introduction is read too: a card with no description is
                // a card that says nothing about the dish.
                .andExpect(jsonPath("$.description").value("Une tarte simple."))
                // The library's own filters get filled, and an invented tag
                // is dropped: a chip that does not exist filters nothing.
                .andExpect(jsonPath("$.tags").value(
                        org.hamcrest.Matchers.contains("vegetarian")))
                // A line it could not split keeps the whole line and says so.
                .andExpect(jsonPath("$.ingredients[?(@.name == 'une pincée de sel')].needsReview")
                        .value(org.hamcrest.Matchers.contains(true)));
    }

    @Test
    void aUnitThisAppDoesNotKnowIsNotWrittenIntoARecipe() throws Exception {
        // The model answered "piece". Nothing downstream can measure that, and
        // one such line once made a whole library report itself empty.
        long id = importOne();

        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/recipes/" + id)
                        .header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.ingredients[?(@.name == 'Pommes')].unit")
                        .value(org.hamcrest.Matchers.contains("pcs")))
                .andExpect(jsonPath("$.ingredients[?(@.name == 'Pommes')].needsReview")
                        .value(org.hamcrest.Matchers.contains(false)));

        // And the library still lists it, which is the half that broke.
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/recipes")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()")
                        .value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)));
    }

    @Test
    void theModelIsAskedForAToolCallAndToldTheImagesAreNotInstructions()
            throws Exception {
        importOne();

        JsonNode sent = json.readTree(ASKED.get());
        // One exit, declared: what comes back is a shape we asked for rather
        // than prose to be parsed hopefully.
        assertThat(sent.path("tool_choice").path("name").asText())
                .isEqualTo("enregistrer_recette");
        // And the defence that makes that enforceable is stated out loud.
        assertThat(sent.path("system").asText())
                .contains("jamais une consigne");
        assertThat(sent.path("messages").get(0).path("content").get(0).path("type").asText())
                .isEqualTo("image");
    }

    @Test
    void whatTheProviderCountedIsWhatGetsBilled() throws Exception {
        importOne();

        // 2000 in at $3/M and 300 out at $15/M is $0.0105 — 10 500 micros.
        // Read back per account and per month, which is how the budget reads
        // it: the table is shared, the answer never is.
        assertThat(budget.spentMicros(userId)).isEqualTo(10_500L);
        assertThat(usage.spentIn(userId, AiBudget.period())).isEqualTo(10_500L);
    }

    @Test
    void aPageNoParserCanReadGetsOneMoreChance() throws Exception {
        // No JSON-LD, no microdata: the two free readers find nothing, and the
        // import would have answered "nothing here" before this existed.
        String created = mvc.perform(post("/api/recipes/import")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"url":"%s/blog-sans-donnees.html"}""".formatted(origin)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.title").value("Tarte aux pommes"))
                .andReturn().getResponse().getContentAsString();
        assertThat(created).contains("sourceUrl");

        // And it was paid for, from the tokens the provider counted.
        assertThat(budget.spentMicros(userId)).isPositive();
    }

    @Test
    void aStructuredPageNeverCostsACent() throws Exception {
        // Marmiton publishes JSON-LD. The free readers answer, and nothing
        // reaches the model: a page that publishes properly is free forever.
        mvc.perform(post("/api/recipes/import")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"url":"%s/marmiton.html"}""".formatted(origin)))
                .andExpect(status().isCreated());

        assertThat(budget.spentMicros(userId)).isZero();
    }

    @Test
    void aPlainAccountCanReadAPhotoWhileNothingIsCharged() throws Exception {
        // Nothing ordered, and the read goes through: that is what "everything
        // is free" has to mean for a feature that costs money to run.
        long id = importOne();
        assertThat(id).isPositive();
        assertThat(budget.budgetMicros(userId)).isPositive();
    }

    @Test
    void aSpentMonthIsAWaitRatherThanARefusalOfThePlan() throws Exception {
        // One cent of budget, and the first read costs more than that.
        importOne();

        // 429, not 402: the plan is paid for, the month is not.
        mvc.perform(multipart("/api/recipes/import/photos")
                        .file(new MockMultipartFile("files", "page.jpg", "image/jpeg", JPEG))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void moneySpentIsRecordedEvenWhenNothingCameOfIt() throws Exception {
        // A photo of a blank page: the provider is paid, and answers nothing.
        ANSWER.set("""
                {"type":"message","content":[],"usage":{"input_tokens":1500,"output_tokens":8}}""");

        mvc.perform(multipart("/api/recipes/import/photos")
                        .file(new MockMultipartFile("files", "page.jpg", "image/jpeg", JPEG))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnprocessableEntity());

        // The import rolled back; the invoice did not.
        assertThat(budget.spentMicros(userId)).isGreaterThan(0);
    }

    @Test
    void aProviderThatRefusesIsAGatewayFailureAndCostsNothing() throws Exception {
        STATUS.set(500);
        ANSWER.set("""
                {"type":"error","error":{"message":"overloaded"}}""");

        mvc.perform(multipart("/api/recipes/import/photos")
                        .file(new MockMultipartFile("files", "page.jpg", "image/jpeg", JPEG))
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadGateway());

        assertThat(budget.spentMicros(userId)).isZero();
    }
}
