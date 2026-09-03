package ch.celestin.fuelr.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The two ceilings, and why there are two.
 *
 * One bounds a person. The other bounds the invoice — this app is public, so a
 * per-account budget multiplied by however many strangers register is not a
 * bound at all, and the second ceiling is the only thing that actually is one.
 */
@SpringBootTest(properties = {
        "app.subscription.enforce=false",
        "app.ai.price.input-per-million=3.00",
        "app.ai.price.output-per-million=15.00",
        // A generous budget each, and almost nothing between all of them.
        "app.ai.budget.launch-cents=1000",
        "app.ai.budget.total-cents=2",
})
@AutoConfigureMockMvc
@Testcontainers
class AiBudgetCeilingTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17");

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired AiBudget budget;

    private long register() throws Exception {
        String response = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"ceiling-%d@fuelr.app","name":"Chef","password":"motdepasse123"}"""
                                .formatted(System.nanoTime())))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("user").get("id").asLong();
    }

    @Test
    void oneBudgetForEverybodyWhileNothingIsCharged() throws Exception {
        long userId = register();

        // Ten euros' worth of ceiling for an account that ordered nothing:
        // during the launch the tier is not what decides.
        assertThat(budget.budgetMicros(userId)).isEqualTo(1000L * 10_000L);
    }

    @Test
    void aStrangerCannotSpendWhatEverybodyElseAlreadyHas() throws Exception {
        long first = register();
        long second = register();

        // The first account spends past the total, well inside its own budget.
        budget.record(first, "IMPORT_PHOTO", "test", 10_000, 1_000);
        assertThat(budget.spentMicros(first)).isLessThan(budget.budgetMicros(first));
        assertThat(budget.spentEverywhereMicros())
                .isGreaterThanOrEqualTo(budget.totalBudgetMicros());

        // And the second is refused, having spent nothing at all: the ceiling
        // that bounds the invoice is not the one that bounds a person.
        assertThat(budget.spentMicros(second)).isZero();
        assertThatThrownBy(() -> budget.require(second))
                .isInstanceOf(AiBudget.ExhaustedException.class)
                .hasMessage("ai_budget_exhausted");
    }
}
