package ch.celestin.fuelr.plan;

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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Dishes invented so the work can be shared.
 *
 * Like the week fill, nothing here comes out of the library: somebody asking
 * for a batch wants dishes they have not had. What is asserted is mostly what
 * is *refused* — sharing an ingredient is not sharing work, so a set a model
 * claims but does not deliver comes back as no set at all, and the tests are
 * about salt as much as about lentils.
 */
@SpringBootTest(properties = {
        "app.ai.api-key=test-key",
        "app.ai.price.input-per-million=3.00",
        "app.ai.price.output-per-million=15.00",
        "app.subscription.enforce=false",
        "app.subscription.self-activate=false",
        "app.ai.budget.launch-cents=200",
        "app.ai.budget.total-cents=1000000",
})
@AutoConfigureMockMvc
@Testcontainers
class BatchSuggestionTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17");

    private static HttpServer server;
    private static String origin;
    private static final AtomicReference<String> ANSWER = new AtomicReference<>();
    private static final AtomicInteger CALLS = new AtomicInteger();
    private static final AtomicReference<String> ASKED = new AtomicReference<>();

    @BeforeAll
    static void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/messages", exchange -> {
            CALLS.incrementAndGet();
            ASKED.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
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
        CALLS.set(0);
        ANSWER.set(sharingIdeas());
        String response = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"batch-%d@fuelr.app","name":"Chef","password":"motdepasse123"}"""
                                .formatted(System.nanoTime())))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        token = json.readTree(response).get("token").asText();
        userId = json.readTree(response).get("user").get("id").asLong();
    }

    /** A recipe with exactly the lines the test wants to reason about. */
    private long recipe(String title, String ingredients, String... tags) throws Exception {
        String created = mvc.perform(post("/api/recipes").header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(created).get("id").asLong();

        StringBuilder tagList = new StringBuilder();
        for (String tag : tags) {
            if (tagList.length() > 0) tagList.append(",");
            tagList.append("\"").append(tag).append("\"");
        }
        mvc.perform(put("/api/recipes/" + id)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"%s","servings":4,"tags":[%s],
                                 "ingredients":[%s],"steps":["Cuire 20 min."]}"""
                                .formatted(title, tagList, ingredients)))
                .andExpect(status().isOk());
        return id;
    }

    private org.springframework.test.web.servlet.ResultActions ask(String body) throws Exception {
        return mvc.perform(post("/api/plan/suggest/batch")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    /** Three dishes a model wrote, built on the same 300 g of lentils. */
    private static String sharingIdeas() {
        return """
                {"type":"message","content":[{"type":"tool_use","id":"t1",
                  "name":"proposer_des_plats","input":{"plats":[
                    {"titre":"Dahl","minutes":30,"manque":[],
                     "ingredients":[{"nom":"Lentilles","quantite":300,"unite":"g","aVerifier":false}],
                     "etapes":["Cuire."]},
                    {"titre":"Soupe de lentilles","minutes":25,"manque":[],
                     "ingredients":[{"nom":"Lentilles","quantite":300,"unite":"g","aVerifier":false}],
                     "etapes":["Cuire."]},
                    {"titre":"Salade de lentilles","minutes":20,"manque":[],
                     "ingredients":[{"nom":"Lentilles","quantite":300,"unite":"g","aVerifier":false}],
                     "etapes":["Cuire."]}]}}],
                 "usage":{"input_tokens":800,"output_tokens":300}}""";
    }

    /** Three dishes a model wrote that share nothing anybody would prepare once. */
    private static String unsharingIdeas() {
        return """
                {"type":"message","content":[{"type":"tool_use","id":"t1",
                  "name":"proposer_des_plats","input":{"plats":[
                    {"titre":"Plat A","minutes":30,"manque":[],
                     "ingredients":[{"nom":"Sel","quantite":1,"unite":"c.à.c","aVerifier":false}],
                     "etapes":["Cuire."]},
                    {"titre":"Plat B","minutes":25,"manque":[],
                     "ingredients":[{"nom":"Sel","quantite":1,"unite":"c.à.c","aVerifier":false}],
                     "etapes":["Cuire."]},
                    {"titre":"Plat C","minutes":20,"manque":[],
                     "ingredients":[{"nom":"Sel","quantite":1,"unite":"c.à.c","aVerifier":false}],
                     "etapes":["Cuire."]}]}}],
                 "usage":{"input_tokens":800,"output_tokens":300}}""";
    }

    /** Three dishes sharing one onion each — an ingredient, not a base. */
    private static String onionIdeas() {
        return """
                {"type":"message","content":[{"type":"tool_use","id":"t1",
                  "name":"proposer_des_plats","input":{"plats":[
                    {"titre":"Plat A","minutes":30,"manque":[],
                     "ingredients":[{"nom":"Oignon","quantite":1,"unite":"pcs","aVerifier":false}],
                     "etapes":["Cuire."]},
                    {"titre":"Plat B","minutes":25,"manque":[],
                     "ingredients":[{"nom":"Oignon","quantite":1,"unite":"pcs","aVerifier":false}],
                     "etapes":["Cuire."]},
                    {"titre":"Plat C","minutes":20,"manque":[],
                     "ingredients":[{"nom":"Oignon","quantite":1,"unite":"pcs","aVerifier":false}],
                     "etapes":["Cuire."]}]}}],
                 "usage":{"input_tokens":800,"output_tokens":300}}""";
    }

    // --- it invents, and the sharing is counted rather than claimed ---------

    @Test
    void aSetSaysWhatItIsASetBecauseOf() throws Exception {
        // Three recipes that would have made a perfect set. None is proposed:
        // asking for a batch is asking for something new.
        recipe("Dahl", """
                {"name":"Lentilles corail","quantity":300,"unit":"g"}""");
        recipe("Soupe de lentilles", """
                {"name":"Lentilles corail","quantity":250,"unit":"g"}""");

        ask("""
                {"size":3}""")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.declined").value("NONE"))
                .andExpect(jsonPath("$.sets[0].members.length()").value(3))
                .andExpect(jsonPath("$.sets[0].members[0].title").value("Dahl"))
                // Whole, so accepting one writes a draft without a second bill.
                .andExpect(jsonPath("$.sets[0].members[0].idea.steps.length()").value(1))
                // Counted from the lines the model wrote: 300 × 3 across three
                // dishes, not something it said about itself.
                .andExpect(jsonPath("$.sets[0].bases[0].name").value("Lentilles"))
                .andExpect(jsonPath("$.sets[0].bases[0].dishes").value(3))
                .andExpect(jsonPath("$.sets[0].bases[0].quantity").value(900.0))
                .andExpect(jsonPath("$.sets[0].sharedBy").value(3));

        assertThat(CALLS.get()).isOne();
        assertThat(budget.spentMicros(userId)).isPositive();
        assertThat(ASKED.get()).contains("une seule session");
    }

    @Test
    void aSetAModelClaimsButDoesNotShareIsDropped() throws Exception {
        // Three dishes sharing a teaspoon of salt. Asking for a common base and
        // being told there is one are two different things, and only the second
        // is checkable.
        ANSWER.set(unsharingIdeas());
        ask("""
                {"size":3}""")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sets.length()").value(0))
                .andExpect(jsonPath("$.declined").value("FAILED"));
    }

    @Test
    void anOnionInEveryDishIsNotABase() throws Exception {
        // One onion each, in quantity 1, and nothing else in common. Peeling
        // three onions on Sunday saves nobody anything.
        ANSWER.set(onionIdeas());
        ask("""
                {"size":3}""")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sets.length()").value(0));
    }

    // --- a refusal has a name, because there is no second source ------------

    @Test
    void anExhaustedBudgetSaysSoRatherThanReturningNothingQuietly() throws Exception {
        budget.record(userId, "TEST", "test", 1_000_000L, 1_000_000L);

        ask("""
                {"size":2}""")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sets.length()").value(0))
                // The wait has a date, and the screen can say which one it is.
                .andExpect(jsonPath("$.declined").value("BUDGET"));
    }

    @Test
    void nothingIsWrittenToThePlan() throws Exception {
        ask("""
                {"size":2}""").andExpect(status().isOk());

        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/plan").param("week", "2026-03-02")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.meals.length()").value(0));
    }

    @Test
    void batchingNeedsASession() throws Exception {
        mvc.perform(post("/api/plan/suggest/batch")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"size":3}"""))
                .andExpect(status().isUnauthorized());
    }
}
