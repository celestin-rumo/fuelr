package ch.celestin.fuelr.recipe.importer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
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

import java.io.IOException;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The whole path, over real HTTP, without touching the internet: a local server
 * hands out the captured pages. Pointing the suite at Marmiton would make it
 * fail whenever they redesign — which is their right, and not a regression.
 */
@SpringBootTest(properties = "app.import.allow-private-hosts=true")
@AutoConfigureMockMvc
@Testcontainers
class RecipeImportApiTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17");

    private static HttpServer server;
    private static String origin;

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    @BeforeAll
    static void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            String fixture = exchange.getRequestURI().getPath().substring(1);
            byte[] body;
            try (InputStream stream =
                         RecipeImportApiTest.class.getResourceAsStream("/import/" + fixture)) {
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
        });
        server.start();
        origin = "http://127.0.0.1:" + server.getAddress().getPort();
    }

    @AfterAll
    static void stopServer() {
        server.stop(0);
    }

    private String signIn() throws Exception {
        String response = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"import-%d@fuelr.app","name":"Chef","password":"motdepasse123"}"""
                                .formatted(System.nanoTime())))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("token").asText();
    }

    private org.springframework.test.web.servlet.ResultActions importing(String fixture)
            throws Exception {
        return mvc.perform(post("/api/recipes/import")
                .header("Authorization", "Bearer " + signIn())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"url":"%s/%s"}""".formatted(origin, fixture)));
    }

    @Test
    void importsADraftAndRemembersWhereItCameFrom() throws Exception {
        importing("marmiton.html")
                .andExpect(status().isCreated())
                // Never published: the cook decides, after looking.
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.title").value(org.hamcrest.Matchers.containsString("Pâte à pizza")))
                .andExpect(jsonPath("$.servings").value(4))
                .andExpect(jsonPath("$.totalMinutes").value(20))
                .andExpect(jsonPath("$.sourceUrl").value(org.hamcrest.Matchers.containsString("marmiton.html")))
                .andExpect(jsonPath("$.ingredients.length()").value(org.hamcrest.Matchers.greaterThan(3)))
                .andExpect(jsonPath("$.steps.length()").value(org.hamcrest.Matchers.greaterThan(2)));
    }

    @Test
    void saysWhichFieldsItHadToGuessAt() throws Exception {
        // Swissmilk yields "env. 600 g de pâte" — not a number of servings.
        importing("swissmilk.html")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.unverified").value(org.hamcrest.Matchers.hasItem("servings")));
    }

    @Test
    void importsWhatASubscriptionSitePublishesAndFlagsTheRest() throws Exception {
        // Cookidoo gives ingredients away and keeps the method behind the
        // paywall. Half a recipe beats retyping all of it — as long as it says so.
        importing("cookidoo.html")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.ingredients.length()").value(org.hamcrest.Matchers.greaterThan(2)))
                .andExpect(jsonPath("$.steps.length()").value(0))
                .andExpect(jsonPath("$.unverified").value(org.hamcrest.Matchers.hasItem("steps")));
    }

    @Test
    void marksTheLinesItCouldNotRead() throws Exception {
        importing("fooby.html")
                .andExpect(status().isCreated())
                // A filter yields the matching array, so assert on that: asking
                // it for a length gives a JSONArray, not a number.
                .andExpect(jsonPath("$.ingredients[?(@.needsReview == true)]").isNotEmpty());
    }

    @Test
    void aPageWithoutARecipeIsRefusedAsUnreadable() throws Exception {
        // 422, not 502: the page answered, it just held nothing to import —
        // and the screen says something different for each.
        importing("nothing-here.html").andExpect(status().isUnprocessableEntity());
    }

    @Test
    void anUnreachablePageIsAGatewayFailure() throws Exception {
        mvc.perform(post("/api/recipes/import")
                        .header("Authorization", "Bearer " + signIn())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"url":"http://127.0.0.1:1/nothing"}"""))
                .andExpect(status().isBadGateway());
    }

    @Test
    void importingNeedsASession() throws Exception {
        mvc.perform(post("/api/recipes/import")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"url":"%s/marmiton.html"}""".formatted(origin)))
                .andExpect(status().isUnauthorized());
    }
}
