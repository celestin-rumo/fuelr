package ch.celestin.fuelr.menu;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
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
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * An answer told as it is written.
 *
 * The stand-in here streams the way the provider does — the tool's input in
 * fragments of JSON text, a title split across two of them — and the screen
 * is told each dish once, by its whole title, and then handed the same
 * answer the one-piece endpoint gives.
 */
@SpringBootTest(properties = {
        // Open, like the launch: what is under test is the telling, not the tier.
        "app.subscription.enforce=false",
        "app.subscription.self-activate=false",
        "app.ai.api-key=stand-in",
})
@AutoConfigureMockMvc
@Testcontainers
class IdeaStreamTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17");

    private static final ObjectMapper JSON = new ObjectMapper();

    private static HttpServer server;
    private static String origin;

    @BeforeAll
    static void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/messages", exchange -> {
            exchange.getRequestBody().readAllBytes();
            byte[] body = streamed().getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "text/event-stream");
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

    /** The provider's events, with the first title cut in two on purpose. */
    private static String streamed() {
        List<String> fragments = List.of(
                "{\"plats\":[{\"titre\":\"Dahl de len",
                "tilles\",\"minutes\":25,\"ingredients\":[{\"nom\":\"Lentilles\",\"quantite\":300,"
                        + "\"unite\":\"g\"}],\"etapes\":[\"Cuire.\"]},",
                "{\"titre\":\"Soupe de courge\",\"ingredients\":[{\"nom\":\"Courge\",\"quantite\":500,"
                        + "\"unite\":\"g\"}],\"etapes\":[\"Mixer.\"]}]}");
        StringBuilder out = new StringBuilder();
        out.append(event("message_start",
                "{\"type\":\"message_start\",\"message\":{\"usage\":{\"input_tokens\":800,\"output_tokens\":1}}}"));
        out.append(event("content_block_start",
                "{\"type\":\"content_block_start\",\"index\":0,\"content_block\":"
                        + "{\"type\":\"tool_use\",\"id\":\"t1\",\"name\":\"proposer_des_plats\",\"input\":{}}}"));
        for (String fragment : fragments) {
            ObjectNode delta = JSON.createObjectNode();
            delta.put("type", "content_block_delta");
            delta.put("index", 0);
            delta.putObject("delta").put("type", "input_json_delta").put("partial_json", fragment);
            out.append(event("content_block_delta", delta.toString()));
        }
        out.append(event("content_block_stop", "{\"type\":\"content_block_stop\",\"index\":0}"));
        out.append(event("message_delta",
                "{\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"tool_use\"},\"usage\":{\"output_tokens\":300}}"));
        out.append(event("message_stop", "{\"type\":\"message_stop\"}"));
        return out.toString();
    }

    private static String event(String name, String data) {
        return "event: " + name + "\ndata: " + data + "\n\n";
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String token;

    @BeforeEach
    void signIn() throws Exception {
        String response = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"stream-%d@fuelr.app","name":"Chef","password":"motdepasse123"}"""
                                .formatted(System.nanoTime())))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        token = json.readTree(response).get("token").asText();
    }

    @Test
    void theScreenIsToldEachDishOnceByItsWholeTitleAndThenTheAnswer() throws Exception {
        MvcResult started = mvc.perform(post("/api/plan/suggest/live")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"week":"2026-03-02"}"""))
                .andExpect(request().asyncStarted())
                .andReturn();
        started.getAsyncResult();
        String events = started.getResponse().getContentAsString();

        // Told as it is written: dish 1 by its whole title, although the
        // title arrived in two pieces, and never twice.
        assertThat(events).contains("event:progress");
        assertThat(events).containsOnlyOnce("{\"done\":1,\"of\":7,\"title\":\"Dahl de lentilles\"}");
        assertThat(events).containsOnlyOnce("{\"done\":2,\"of\":7,\"title\":\"Soupe de courge\"}");
        assertThat(events).doesNotContain("Dahl de len\"");

        // Each dish written to the end, placed on its slot, before the answer.
        assertThat(events).containsOnlyOnce("{\"index\":1,\"of\":7,\"dish\":{\"date\":\"2026-03-02\",\"slot\":\"DINNER\",\"title\":\"Dahl de lentilles\"");
        assertThat(events).contains("{\"index\":2,\"of\":7,\"dish\":{\"date\":\"2026-03-03\"");
        assertThat(events.indexOf("event:dish")).isLessThan(events.indexOf("event:result"));

        // Then the whole answer, as the one-piece endpoint would give it.
        assertThat(events).contains("event:result");
        assertThat(events).contains("\"declined\":\"NONE\"");
        assertThat(events).contains("\"unfilled\":5");
        assertThat(events).contains("\"title\":\"Dahl de lentilles\",\"minutes\":25");
    }

    @Test
    void theOnePieceEndpointReadsTheSameStreamWithoutBeingToldAnything() throws Exception {
        mvc.perform(post("/api/plan/suggest")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"week":"2026-03-02"}"""))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .jsonPath("$.proposals.length()").value(2))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .jsonPath("$.proposals[0].title").value("Dahl de lentilles"));
    }
}
