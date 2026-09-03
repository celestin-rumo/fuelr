package ch.celestin.fuelr.subscription;

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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class SubscriptionApiTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17");

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired SubscriptionService subscriptions;
    @Autowired Entitlements entitlements;

    private String token;
    private long userId;

    @BeforeEach
    void signIn() throws Exception {
        String response = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"sub-%d@fuelr.app","name":"Chef","password":"motdepasse123"}"""
                                .formatted(System.nanoTime())))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        token = json.readTree(response).get("token").asText();
        userId = json.readTree(response).get("user").get("id").asLong();
    }

    @Test
    void anAccountThatNeverSubscribedIsFreeAndHasNoPaidFeature() throws Exception {
        mvc.perform(get("/api/subscription").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tier").value("FREE"))
                .andExpect(jsonPath("$.features").isEmpty());
    }

    @Test
    void askingForAPlanOpensItWhereNothingCanTakeThePayment() throws Exception {
        mvc.perform(post("/api/subscription/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"tier":"FAMILY","period":"YEARLY"}"""))
                // Accepted, not created: an order is a request to pay, and the
                // answer carries a checkout the day there is one.
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.tier").value("FAMILY"))
                .andExpect(jsonPath("$.checkoutUrl").doesNotExist());

        mvc.perform(get("/api/subscription").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.tier").value("FAMILY"))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.features[0]").value("HOUSEHOLD_SHARING"));
    }

    @Test
    void theFreePlanIsNotSomethingYouOrder() throws Exception {
        mvc.perform(post("/api/subscription/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"tier":"FREE"}"""))
                .andExpect(status().isBadRequest());
    }

    @Test
    void anUnknownPlanIsRefusedRatherThanGuessedAt() throws Exception {
        mvc.perform(post("/api/subscription/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"tier":"PLATINUM"}"""))
                .andExpect(status().isBadRequest());
    }

    @Test
    void cancellingDropsTheAccessAndKeepsTheRecord() throws Exception {
        order("FAMILY");

        mvc.perform(delete("/api/subscription").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tier").value("FREE"))
                .andExpect(jsonPath("$.status").value("CANCELED"))
                .andExpect(jsonPath("$.features").isEmpty());

        // The row is still there — cancelling is not deleting, and re-ordering
        // has to put everything back exactly as it was.
        assertThat(subscriptions.find(userId)).isPresent();
        order("FAMILY");
        assertThat(entitlements.tierOf(userId)).isEqualTo(Tier.FAMILY);
    }

    @Test
    void confirmingTheSameOrderTwiceChangesNothing() {
        SubscriptionOrder order =
                subscriptions.order(userId, Tier.FAMILY, BillingPeriod.MONTHLY).order();

        // A provider retries its webhook. The second delivery must not extend
        // anything, which is why confirm is written to be idempotent.
        Subscription first = subscriptions.confirm(order.getId(), "test", "ref-1");
        Subscription again = subscriptions.confirm(order.getId(), "test", "ref-1");

        assertThat(again.getId()).isEqualTo(first.getId());
        assertThat(again.getCurrentPeriodEnd()).isEqualTo(first.getCurrentPeriodEnd());
    }

    @Test
    void aPaidPlanLapsesOnItsOwnWhenItsPeriodRunsOut() {
        Subscription subscription = new Subscription(userId);
        subscription.activate(
                Tier.FAMILY, BillingPeriod.MONTHLY,
                java.time.Instant.now().minusSeconds(60), "test", "ref");

        // Nothing runs at midnight to do this. The row says when it ends, and
        // reading it is what decides.
        assertThat(subscription.tierNow()).isEqualTo(Tier.FREE);
    }

    @Test
    void theSubscriptionIsNotPublic() throws Exception {
        mvc.perform(get("/api/subscription")).andExpect(status().isUnauthorized());
    }

    private void order(String tier) throws Exception {
        mvc.perform(post("/api/subscription/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"tier":"%s"}""".formatted(tier)))
                .andExpect(status().isAccepted());
    }
}
