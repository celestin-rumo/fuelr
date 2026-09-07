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
 * Dishes chosen so the work can be shared.
 *
 * What is asserted here is mostly what is *refused*. Sharing an ingredient is
 * not sharing work: four dishes that all contain one onion are not a batch, and
 * a set that says so would look rigorous while wasting somebody's afternoon.
 * So the tests are about salt, saffron and onions as much as about lentils.
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

    // --- the library, which costs nothing ------------------------------------

    @Test
    void aSetSaysWhatItIsASetBecauseOf() throws Exception {
        recipe("Dahl", """
                {"name":"Lentilles corail","quantity":300,"unit":"g"}""");
        recipe("Soupe de lentilles", """
                {"name":"Lentilles corail","quantity":250,"unit":"g"}""");
        recipe("Salade de lentilles", """
                {"name":"Lentilles corail","quantity":200,"unit":"g"}""");

        ask("""
                {"size":3}""")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assisted").value(false))
                .andExpect(jsonPath("$.sets[0].members.length()").value(3))
                // Counted, not asserted: 300 + 250 + 200 across three dishes.
                .andExpect(jsonPath("$.sets[0].bases[0].name").value("Lentilles corail"))
                .andExpect(jsonPath("$.sets[0].bases[0].dishes").value(3))
                .andExpect(jsonPath("$.sets[0].bases[0].quantity").value(750.0))
                .andExpect(jsonPath("$.sets[0].sharedBy").value(3));

        assertThat(budget.spentMicros(userId)).isZero();
        assertThat(CALLS.get()).isZero();
    }

    @Test
    void anOnionInEveryDishIsNotABase() throws Exception {
        // One onion each, and nothing else in common. Peeling four onions on
        // Sunday saves nobody anything, so this is not a batch.
        recipe("Plat A", """
                {"name":"Oignon","quantity":1,"unit":"pcs"},
                {"name":"Poulet","quantity":300,"unit":"g"}""");
        recipe("Plat B", """
                {"name":"Oignon","quantity":1,"unit":"pcs"},
                {"name":"Cabillaud","quantity":300,"unit":"g"}""");
        recipe("Plat C", """
                {"name":"Oignon","quantity":1,"unit":"pcs"},
                {"name":"Tofu","quantity":300,"unit":"g"}""");

        // No model reachable for this account's request either — an empty list
        // is the honest answer, and it is not an error.
        ANSWER.set(unsharingIdeas());
        ask("""
                {"size":3}""")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sets.length()").value(0))
                .andExpect(jsonPath("$.assisted").value(false));
    }

    @Test
    void aPinchOfSaffronIsACoincidenceRatherThanAPreparation() throws Exception {
        recipe("Plat A", """
                {"name":"Safran","quantity":1,"unit":"c.à.c"},
                {"name":"Poulet","quantity":300,"unit":"g"}""");
        recipe("Plat B", """
                {"name":"Safran","quantity":1,"unit":"c.à.c"},
                {"name":"Cabillaud","quantity":300,"unit":"g"}""");
        recipe("Plat C", """
                {"name":"Safran","quantity":1,"unit":"c.à.c"},
                {"name":"Tofu","quantity":300,"unit":"g"}""");

        ANSWER.set(unsharingIdeas());
        ask("""
                {"size":3}""")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sets.length()").value(0));
    }

    @Test
    void whatSomebodyAlreadyTaggedBatchComesFirst() throws Exception {
        // All three share the base; only one carries the tag. Somebody saying
        // "this one batches" is better information than anything computed.
        recipe("Sans étiquette", """
                {"name":"Riz","quantity":300,"unit":"g"}""");
        recipe("Étiqueté", """
                {"name":"Riz","quantity":300,"unit":"g"}""", "batch");
        recipe("Sans étiquette non plus", """
                {"name":"Riz","quantity":300,"unit":"g"}""");

        ask("""
                {"size":3}""")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sets[0].members[0].title").value("Étiqueté"))
                .andExpect(jsonPath("$.sets[0].members[0].taggedBatch").value(true));
    }

    @Test
    void aDraftIsNeverPartOfASet() throws Exception {
        recipe("Dahl", """
                {"name":"Lentilles","quantity":300,"unit":"g"}""");
        recipe("Soupe", """
                {"name":"Lentilles","quantity":300,"unit":"g"}""");
        // A third recipe nobody finished writing.
        mvc.perform(post("/api/recipes").header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated());

        ANSWER.set(unsharingIdeas());
        ask("""
                {"size":3}""")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sets.length()").value(0));
    }

    // --- the model, only when the library cannot answer at all ---------------

    @Test
    void aModelIsAskedOnlyWhenNothingInTheLibraryBatches() throws Exception {
        // Two dishes with nothing in common, so no set can be built from them.
        recipe("Plat A", """
                {"name":"Poulet","quantity":300,"unit":"g"}""");
        recipe("Plat B", """
                {"name":"Cabillaud","quantity":300,"unit":"g"}""");
        recipe("Plat C", """
                {"name":"Tofu","quantity":300,"unit":"g"}""");

        ask("""
                {"size":3}""")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assisted").value(true))
                .andExpect(jsonPath("$.sets.length()").value(1))
                // An idea is not a recipe, and carries what it takes to become
                // a draft without a second bill.
                .andExpect(jsonPath("$.sets[0].members[0].recipeId").doesNotExist())
                .andExpect(jsonPath("$.sets[0].members[0].idea.steps.length()").value(1))
                // And the sharing was counted from the lines it wrote.
                .andExpect(jsonPath("$.sets[0].bases[0].name").value("Lentilles"))
                .andExpect(jsonPath("$.sets[0].bases[0].dishes").value(3));

        assertThat(budget.spentMicros(userId)).isPositive();
        assertThat(ASKED.get()).contains("une seule session");
    }

    @Test
    void aSetAModelClaimsButDoesNotShareIsDropped() throws Exception {
        recipe("Plat A", """
                {"name":"Poulet","quantity":300,"unit":"g"}""");
        recipe("Plat B", """
                {"name":"Cabillaud","quantity":300,"unit":"g"}""");
        recipe("Plat C", """
                {"name":"Tofu","quantity":300,"unit":"g"}""");

        // Three dishes sharing a teaspoon of salt. Asking for a common base and
        // being told there is one are two different things.
        ANSWER.set(unsharingIdeas());
        ask("""
                {"size":3}""")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sets.length()").value(0))
                .andExpect(jsonPath("$.assisted").value(false));
    }

    @Test
    void anExhaustedBudgetGivesNothingRatherThanAnError() throws Exception {
        recipe("Plat A", """
                {"name":"Poulet","quantity":300,"unit":"g"}""");
        recipe("Plat B", """
                {"name":"Cabillaud","quantity":300,"unit":"g"}""");
        budget.record(userId, "TEST", "test", 1_000_000L, 1_000_000L);

        ask("""
                {"size":2}""")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sets.length()").value(0))
                .andExpect(jsonPath("$.assisted").value(false));
    }

    @Test
    void nothingIsWrittenToThePlan() throws Exception {
        recipe("Dahl", """
                {"name":"Lentilles","quantity":300,"unit":"g"}""");
        recipe("Soupe", """
                {"name":"Lentilles","quantity":300,"unit":"g"}""");

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
