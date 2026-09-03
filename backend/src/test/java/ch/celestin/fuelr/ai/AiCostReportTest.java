package ch.celestin.fuelr.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The operator's view of what the assisted reads cost.
 *
 * Two things are worth asserting: that the figures are the ones recorded, and
 * that nobody but an operator can read them — the page names other people's
 * addresses and what they consumed.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class AiCostReportTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17");

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired AiBudget budget;

    @org.springframework.beans.factory.annotation.Value("${app.admin.email}")
    String adminEmail;

    @org.springframework.beans.factory.annotation.Value("${app.admin.password}")
    String adminPassword;

    private String token;
    private long userId;
    private String email;

    @BeforeEach
    void signIn() throws Exception {
        email = "cost-%d@fuelr.app".formatted(System.nanoTime());
        String response = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","name":"Chef","password":"motdepasse123"}"""
                                .formatted(email)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        token = json.readTree(response).get("token").asText();
        userId = json.readTree(response).get("user").get("id").asLong();
    }

    private String adminToken() throws Exception {
        String response = mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"%s"}"""
                                .formatted(adminEmail, adminPassword)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("token").asText();
    }

    @Test
    void theReportNamesTheAccountAndWhatItSpent() throws Exception {
        // Two reads, as the reader would have recorded them.
        budget.record(userId, "IMPORT_PHOTO", "anthropic", 3000, 600);
        budget.record(userId, "IMPORT_SCREENSHOT", "anthropic", 1000, 200);

        mvc.perform(get("/api/admin/ai-costs")
                        .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.month.calls")
                        .value(org.hamcrest.Matchers.greaterThanOrEqualTo(2)))
                .andExpect(jsonPath("$.accountsThisMonth[?(@.email == '%s')].calls".formatted(email))
                        .value(org.hamcrest.Matchers.contains(2)))
                // 3000 in at $3/M and 600 out at $15/M is 18 000 micros, plus
                // 1000/200 at 6 000 — the figures are summed, not re-derived.
                .andExpect(jsonPath("$.accountsThisMonth[?(@.email == '%s')].costMicros".formatted(email))
                        .value(org.hamcrest.Matchers.contains(24_000)))
                .andExpect(jsonPath("$.accountsThisMonth[?(@.email == '%s')].inputTokens".formatted(email))
                        .value(org.hamcrest.Matchers.contains(4000)))
                // The ceiling travels with the row, so a line reads on its own.
                .andExpect(jsonPath("$.accountsThisMonth[?(@.email == '%s')].budgetMicros".formatted(email))
                        .isNotEmpty());
    }

    @Test
    void eachKindOfReadIsCountedSeparately() throws Exception {
        budget.record(userId, "IMPORT_PHOTO", "anthropic", 3000, 600);

        mvc.perform(get("/api/admin/ai-costs")
                        .header("Authorization", "Bearer " + adminToken()))
                .andExpect(jsonPath("$.operationsThisMonth[?(@.operation == 'IMPORT_PHOTO')].calls")
                        .value(org.hamcrest.Matchers.hasItem(
                                org.hamcrest.Matchers.greaterThanOrEqualTo(1))));
    }

    @Test
    void anOrdinaryAccountCannotSeeWhatOthersSpent() throws Exception {
        // 404 rather than 403: a page that exists only for operators does not
        // confirm to everybody else that it exists.
        mvc.perform(get("/api/admin/ai-costs").header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    void andNeitherCanSomebodyWithNoSession() throws Exception {
        mvc.perform(get("/api/admin/ai-costs"))
                .andExpect(status().isUnauthorized());
    }
}
