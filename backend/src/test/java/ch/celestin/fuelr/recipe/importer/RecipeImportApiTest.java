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
 *
 * Since the import now fetches the photo a page announces, the same server also
 * serves the images — and rewrites the captures' remote image addresses to its
 * own as it hands them out. The captures keep the shape they were published
 * with, which is what they are here for, and no test reaches the network.
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

    /** JPEG's signature, which is what the storage reads rather than a header. */
    private static final byte[] JPEG_MAGIC = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0};

    private static byte[] jpeg(int size) {
        byte[] bytes = new byte[size];
        System.arraycopy(JPEG_MAGIC, 0, bytes, 0, JPEG_MAGIC.length);
        return bytes;
    }

    /**
     * The images the pages point at.
     *
     * Two of them lie about what they are, which is the point: the content
     * type is written by whoever serves the file, and an import believes the
     * bytes instead.
     */
    private static byte[] image(String path) {
        return switch (path) {
            case "photo.jpg" -> jpeg(2048);
            // A real JPEG, over the 2 MB the storage accepts.
            case "photo-huge.jpg" -> jpeg(3 * 1024 * 1024);
            case "photo.svg" -> ("<svg xmlns=\"http://www.w3.org/2000/svg\">"
                    + "<script>fetch('/steal')</script></svg>").getBytes(StandardCharsets.UTF_8);
            case "photo-lying.jpg" -> "<!doctype html><html><body>Connectez-vous</body></html>"
                    .getBytes(StandardCharsets.UTF_8);
            default -> null;
        };
    }

    @BeforeAll
    static void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            String fixture = exchange.getRequestURI().getPath().substring(1);
            byte[] body = image(fixture);
            // Everything claims to be a JPEG, including the SVG and the HTML.
            String type = "image/jpeg";
            if (body == null) {
                try (InputStream stream =
                             RecipeImportApiTest.class.getResourceAsStream("/import/" + fixture)) {
                    body = stream == null ? null : stream.readAllBytes();
                }
                type = "text/html; charset=utf-8";
                if (body != null) {
                    body = localised(new String(body, StandardCharsets.UTF_8))
                            .getBytes(StandardCharsets.UTF_8);
                }
            }
            if (body == null) {
                exchange.sendResponseHeaders(404, -1);
                exchange.close();
                return;
            }
            exchange.getResponseHeaders().add("Content-Type", type);
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        origin = "http://127.0.0.1:" + server.getAddress().getPort();
    }

    /** Points a capture's image addresses back at this server. */
    private static String localised(String html) {
        return html.replaceAll(
                "https?://(?!127\\.0\\.0\\.1)[^\"'\\s]+\\.(?:jpe?g|png|webp)",
                origin + "/photo.jpg");
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

    // --- the photo the page published --------------------------------------

    @Test
    void thePhotoThePagePublishedArrivesWithTheRecipe() throws Exception {
        // Marmiton points `image` at an `@id`, and the ImageObject it names is
        // a sibling in the same @graph — the shape a capture actually has.
        importing("marmiton.html")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.hasPhoto").value(true));
    }

    @Test
    void anImageGivenAsAListTakesTheFirstOfThem() throws Exception {
        importing("photo-array.html")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.hasPhoto").value(true));
    }

    @Test
    void theStoredPhotoIsServedBackAsTheImageItIs() throws Exception {
        String token = signIn();
        String created = mvc.perform(post("/api/recipes/import")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"url":"%s/photo-array.html"}""".formatted(origin)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(created).get("id").asLong();

        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/recipes/" + id + "/photo")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .header().string("Content-Type", "image/jpeg"));
    }

    @Test
    void aPageWithNoPhotoIsAnOrdinaryImport() throws Exception {
        importing("photo-none.html")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Omelette aux herbes"))
                .andExpect(jsonPath("$.hasPhoto").value(false));
    }

    @Test
    void aPhotoThatIsGoneLeavesTheRecipeStanding() throws Exception {
        importing("photo-missing.html")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Chili sin carne"))
                .andExpect(jsonPath("$.hasPhoto").value(false));
    }

    @Test
    void anSvgIsRefusedHoweverItIsAnnounced() throws Exception {
        // Served as image/jpeg, and still not stored: an SVG is a document
        // that executes script, and the bytes say what it is.
        importing("photo-svg.html")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Soupe de courge"))
                .andExpect(jsonPath("$.hasPhoto").value(false));
    }

    @Test
    void aPageDressedAsAJpegIsNotAPhoto() throws Exception {
        importing("photo-html.html")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.hasPhoto").value(false));
    }

    @Test
    void aPhotoTooHeavyIsSkippedRatherThanStored() throws Exception {
        importing("photo-huge.html")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Gratin dauphinois"))
                .andExpect(jsonPath("$.hasPhoto").value(false));
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
