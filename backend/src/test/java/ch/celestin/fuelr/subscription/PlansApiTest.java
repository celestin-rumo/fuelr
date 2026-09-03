package ch.celestin.fuelr.subscription;

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
 * The prices, and the one door a payment provider will knock on.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class PlansApiTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17");

    @Autowired MockMvc mvc;

    @Test
    void whatThePlansCostIsReadableWithoutAnAccount() throws Exception {
        // Asking somebody to sign up to see a price is the oldest bad pattern
        // on the web, and this endpoint is why the pricing page never does.
        mvc.perform(get("/api/plans"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currency").value("CHF"))
                .andExpect(jsonPath("$.plans.length()").value(Tier.values().length))
                .andExpect(jsonPath("$.plans[?(@.tier == 'PLUS')].monthly").value(
                        org.hamcrest.Matchers.contains(6.90)))
                .andExpect(jsonPath("$.plans[?(@.tier == 'FAMILY')].yearly").value(
                        org.hamcrest.Matchers.contains(119.00)));
    }

    @Test
    void theFreePlanCostsNothingAndOpensNothingPaid() throws Exception {
        mvc.perform(get("/api/plans"))
                .andExpect(jsonPath("$.plans[?(@.tier == 'FREE')].monthly").value(
                        org.hamcrest.Matchers.contains(0)))
                .andExpect(jsonPath("$.plans[?(@.tier == 'FREE')].features").value(
                        org.hamcrest.Matchers.contains(org.hamcrest.Matchers.empty())));
    }

    @Test
    void eachPlanSaysWhatItOpensInTheSameWordsAsTheCodeThatDecides() throws Exception {
        // The page describing a plan and the enum granting it are the same
        // list, so a feature cannot be advertised and not delivered.
        mvc.perform(get("/api/plans"))
                .andExpect(jsonPath("$.plans[?(@.tier == 'FAMILY')].features").value(
                        org.hamcrest.Matchers.contains(
                                org.hamcrest.Matchers.hasItem(Feature.HOUSEHOLD_SHARING.name()))))
                .andExpect(jsonPath("$.plans[?(@.tier == 'PLUS')].features").value(
                        org.hamcrest.Matchers.contains(
                                org.hamcrest.Matchers.not(
                                        org.hamcrest.Matchers.hasItem(
                                                Feature.HOUSEHOLD_SHARING.name())))));
    }

    @Test
    void theWebhookSaysItIsNotWiredRatherThanPretendingToWork() throws Exception {
        // 501, and nothing read: no provider takes money, so nothing here can
        // possibly settle an order — least of all for whoever is asking.
        mvc.perform(post("/api/subscription/webhook")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Signature", "made-up")
                        .content("""
                                {"orderId":1,"paid":true}"""))
                .andExpect(status().isNotImplemented());
    }

    @Test
    void theWebhookNeedsNoSessionAndGrantsNothingWithout() throws Exception {
        // Public by necessity — a provider has no session — which is exactly
        // why it must refuse on its own terms rather than on Spring's.
        mvc.perform(post("/api/subscription/webhook")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isNotImplemented());
    }
}
