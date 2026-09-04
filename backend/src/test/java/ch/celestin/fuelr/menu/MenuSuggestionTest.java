package ch.celestin.fuelr.menu;

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
 * What to cook, from what is in the bag.
 *
 * The library first and for free is the whole design, so most of what is
 * asserted here is about what does *not* happen: a cook whose own recipes
 * answer the question pays nothing, and a model that cannot be reached takes
 * nothing away from them.
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
class MenuSuggestionTest {

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
        ANSWER.set(ideas());
        String response = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"menu-%d@fuelr.app","name":"Chef","password":"motdepasse123"}"""
                                .formatted(System.nanoTime())))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        token = json.readTree(response).get("token").asText();
        userId = json.readTree(response).get("user").get("id").asLong();
    }

    private static String ideas() {
        return """
                {"type":"message","content":[{"type":"tool_use","id":"t1",
                  "name":"proposer_des_plats",
                  "input":{"plats":[
                    {"titre":"Poêlée de poulet aux courgettes","minutes":25,
                     "manque":["crème fraîche"],
                     "ingredients":[
                       {"nom":"Blanc de poulet","quantite":600,"unite":"g","aVerifier":false},
                       {"nom":"Courgette","quantite":3,"unite":"piece","aVerifier":false}],
                     "etapes":["Couper le poulet.","Faire revenir 15 min."]}]}}],
                 "usage":{"input_tokens":900,"output_tokens":400}}""";
    }

    private void recipe(String title, String... ingredients) throws Exception {
        String created = mvc.perform(post("/api/recipes").header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(created).get("id").asLong();

        StringBuilder lines = new StringBuilder();
        for (String ingredient : ingredients) {
            if (lines.length() > 0) lines.append(",");
            lines.append("""
                    {"name":"%s","quantity":200,"unit":"g"}""".formatted(ingredient));
        }
        mvc.perform(put("/api/recipes/" + id)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"%s","servings":4,"ingredients":[%s],
                                 "steps":["Cuire 20 min."]}""".formatted(title, lines)))
                .andExpect(status().isOk());
    }

    private org.springframework.test.web.servlet.ResultActions ask(String have) throws Exception {
        return mvc.perform(post("/api/menu/suggestions")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"have":"%s"}""".formatted(have)));
    }

    @Test
    void aLibraryThatAnswersOnItsOwnCostsNothing() throws Exception {
        // Three of the cook's own recipes is a choice, not a coincidence — so
        // nothing is asked of a model and nothing is spent.
        recipe("Curry de poulet", "Poulet", "Courgette", "Riz");
        recipe("Poulet rôti aux courgettes", "Poulet", "Courgette");
        recipe("Riz sauté au poulet", "Riz", "Poulet");

        ask("poulet, courgettes, riz, du citron")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assisted").value(false))
                .andExpect(jsonPath("$.suggestions.length()").value(3))
                .andExpect(jsonPath("$.suggestions[0].origin").value("RECIPE"))
                // Written by the cook, so it opens rather than becoming a draft.
                .andExpect(jsonPath("$.suggestions[0].recipeId").isNotEmpty());

        assertThat(budget.spentMicros(userId)).isZero();
        assertThat(CALLS.get()).isZero();
    }

    @Test
    void oneMatchIsToppedUpRatherThanOfferedAlone() throws Exception {
        recipe("Curry de poulet", "Poulet", "Courgette");

        ask("poulet, courgettes")
                .andExpect(status().isOk())
                // The cook's own first, and ideas behind it.
                .andExpect(jsonPath("$.suggestions[0].origin").value("RECIPE"))
                .andExpect(jsonPath("$.suggestions[1].origin").value("IDEA"))
                .andExpect(jsonPath("$.assisted").value(true));
    }

    @Test
    void whatTheLibraryCannotAnswerIsAskedOfAModel() throws Exception {
        // Nothing in the library, so every suggestion has to be invented.
        ask("poulet, courgettes")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assisted").value(true))
                .andExpect(jsonPath("$.suggestions[0].origin").value("IDEA"))
                .andExpect(jsonPath("$.suggestions[0].recipeId").doesNotExist())
                // Enough to become a draft without a second call, and a second bill.
                .andExpect(jsonPath("$.suggestions[0].ingredients.length()").value(2))
                .andExpect(jsonPath("$.suggestions[0].steps.length()").value(2))
                // What is missing is named so it can go on a shopping list.
                .andExpect(jsonPath("$.suggestions[0].missing")
                        .value(org.hamcrest.Matchers.contains("crème fraîche")));

        assertThat(budget.spentMicros(userId)).isPositive();
    }

    @Test
    void aUnitTheAppDoesNotKnowNeverReachesADraft() throws Exception {
        // The model answered "piece". Nothing downstream can measure that, and
        // one such line once made a whole library report itself empty.
        ask("poulet, courgettes")
                .andExpect(jsonPath("$.suggestions[0].ingredients[?(@.name == 'Courgette')].unit")
                        .value(org.hamcrest.Matchers.contains("")))
                .andExpect(jsonPath("$.suggestions[0].ingredients[?(@.name == 'Courgette')].needsReview")
                        .value(org.hamcrest.Matchers.contains(true)));
    }

    @Test
    void theModelIsNotAskedToRepeatWhatTheLibraryAlreadyGave() throws Exception {
        recipe("Curry de poulet", "Poulet", "Courgette");

        ask("poulet, courgettes").andExpect(status().isOk());

        // Paying twice for the same dish is paying twice.
        assertThat(ASKED.get()).contains("Curry de poulet");
    }

    @Test
    void aBagNothingMatchesIsAnEmptyAnswerRatherThanAnError() throws Exception {
        ANSWER.set("""
                {"type":"message","content":[{"type":"tool_use","id":"t1",
                  "name":"proposer_des_plats","input":{"plats":[]}}],
                 "usage":{"input_tokens":300,"output_tokens":20}}""");

        ask("zoubidou, tralala")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.suggestions.length()").value(0));
    }

    @Test
    void askingNeedsASession() throws Exception {
        mvc.perform(post("/api/menu/suggestions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"have":"poulet"}"""))
                .andExpect(status().isUnauthorized());
    }
}
