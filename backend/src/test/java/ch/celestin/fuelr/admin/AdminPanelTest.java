package ch.celestin.fuelr.admin;

import ch.celestin.fuelr.auth.OneTimeToken;
import ch.celestin.fuelr.plan.HouseholdInvitation;
import ch.celestin.fuelr.plan.HouseholdInvitationRepository;
import ch.celestin.fuelr.plan.HouseholdRepository;
import com.fasterxml.jackson.databind.JsonNode;
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

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * One door, one role, and the thing behind it that destroys somebody's data.
 *
 * Most of what is asserted here is a refusal. The panel reads other people's
 * addresses and what they consumed; the interesting question is never whether
 * an operator can see it, it is whether anybody else can — and what a deletion
 * takes with it when the account is not alone.
 */
@SpringBootTest(properties = {
        "app.subscription.enforce=true",
        "app.subscription.self-activate=false",
        "app.admin.email=panel-admin@fuelr.test",
        "app.admin.password=motdepasse123",
})
@AutoConfigureMockMvc
@Testcontainers
class AdminPanelTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17");

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired HouseholdRepository households;
    @Autowired HouseholdInvitationRepository invitations;

    private String adminToken;
    private String cookToken;
    private long cookId;

    @BeforeEach
    void signIn() throws Exception {
        adminToken = tokenFor("panel-admin@fuelr.test", "motdepasse123");

        String created = register("cook-%d@fuelr.test".formatted(System.nanoTime()));
        cookToken = json.readTree(created).get("token").asText();
        cookId = json.readTree(created).get("user").get("id").asLong();
    }

    private String register(String email) throws Exception {
        return mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","name":"Chef","password":"motdepasse123"}"""
                                .formatted(email)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
    }

    private String tokenFor(String email, String password) throws Exception {
        String body = mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"%s"}""".formatted(email, password)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("token").asText();
    }

    private long recipe(String token, String title) throws Exception {
        String created = mvc.perform(post("/api/recipes").header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(created).get("id").asLong();
        mvc.perform(put("/api/recipes/" + id)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"%s","servings":4,
                                 "ingredients":[{"name":"Riz","quantity":200,"unit":"g"}],
                                 "steps":["Cuire."]}""".formatted(title)))
                .andExpect(status().isOk());
        return id;
    }

    // --- the door -----------------------------------------------------------

    @Test
    void everySectionIsInvisibleToAnybodyButAnOperator() throws Exception {
        // 404 and not 403, everywhere: a panel that exists only for the
        // operator has no reason to confirm to anybody else that it exists.
        for (String path : new String[] {
                "/api/admin/accounts",
                "/api/admin/accounts/" + cookId,
                "/api/admin/subscriptions",
                "/api/admin/usage",
                "/api/admin/ai-costs",
        }) {
            mvc.perform(get(path).header("Authorization", "Bearer " + cookToken))
                    .andExpect(status().isNotFound());
        }

        mvc.perform(delete("/api/admin/accounts/" + cookId)
                        .header("Authorization", "Bearer " + cookToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void withNoSessionAtAllItIsNotEvenReached() throws Exception {
        mvc.perform(get("/api/admin/accounts")).andExpect(status().isUnauthorized());
    }

    // --- the accounts -------------------------------------------------------

    @Test
    void anOperatorFindsAnAccountFromTheAddressSomebodyWroteFrom() throws Exception {
        String email = json.readTree(
                mvc.perform(get("/api/admin/accounts/" + cookId)
                                .header("Authorization", "Bearer " + adminToken))
                        .andExpect(status().isOk())
                        .andReturn().getResponse().getContentAsString())
                .get("account").get("email").asText();

        mvc.perform(get("/api/admin/accounts")
                        .param("q", email)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].email").value(email));

        mvc.perform(get("/api/admin/accounts")
                        .param("q", "nobody-has-this-address")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void aTierGrantedByHandIsAPlanLikeAnyOther() throws Exception {
        mvc.perform(post("/api/admin/accounts/" + cookId + "/tier")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"tier":"FAMILY","reason":"remboursement"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tier").value("FAMILY"))
                .andExpect(jsonPath("$.status").value("ACTIVE"));

        // The point of going through `SubscriptionService`: it opens the paid
        // feature, with enforcement on. A row written straight into the table
        // would be a second way for a subscription to exist.
        mvc.perform(post("/api/household/invitations")
                        .header("Authorization", "Bearer " + cookToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"guest@fuelr.test","locale":"fr"}"""))
                // 202: the invitation mail is sent asynchronously, precisely so
                // that answering about an address never takes measurably longer
                // for one that exists.
                .andExpect(status().isAccepted());

        // And who did it is written down, with the reason.
        String detail = mvc.perform(get("/api/admin/accounts/" + cookId)
                        .header("Authorization", "Bearer " + adminToken))
                .andReturn().getResponse().getContentAsString();
        JsonNode history = json.readTree(detail).get("history");
        assertThat(history).hasSize(1);
        assertThat(history.get(0).get("actorEmail").asText()).isEqualTo("panel-admin@fuelr.test");
        assertThat(history.get(0).get("detail").asText()).contains("FAMILY", "remboursement");
    }

    @Test
    void takingATierAwayEndsThePlanWithoutDeletingAnything() throws Exception {
        long kept = recipe(cookToken, "Curry");

        mvc.perform(post("/api/admin/accounts/" + cookId + "/tier")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"tier":"PLUS"}"""))
                .andExpect(status().isOk());

        mvc.perform(post("/api/admin/accounts/" + cookId + "/tier")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"tier":"FREE"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELED"));

        // The pricing page promises this and the panel must not be where it
        // stops being true.
        mvc.perform(get("/api/recipes/" + kept)
                        .header("Authorization", "Bearer " + cookToken))
                .andExpect(status().isOk());
    }

    @Test
    void anUnknownTierIsRefusedRatherThanGuessed() throws Exception {
        mvc.perform(post("/api/admin/accounts/" + cookId + "/tier")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"tier":"PLATINUM"}"""))
                .andExpect(status().isBadRequest());
    }

    // --- the deletion, and the one it must not take with it ------------------

    @Test
    void deletingAnAccountSaysWhatItWillCarryAwayBeforeItDoesIt() throws Exception {
        recipe(cookToken, "Curry");
        recipe(cookToken, "Soupe");

        mvc.perform(get("/api/admin/accounts/" + cookId + "/deletion-preview")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recipes").value(2))
                .andExpect(jsonPath("$.householdHandedOver").value(false));

        // Still there: a preview reads.
        mvc.perform(get("/api/admin/accounts/" + cookId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
    }

    @Test
    void deletingAnAccountTakesEverythingItContains() throws Exception {
        long owned = recipe(cookToken, "Curry");

        mvc.perform(delete("/api/admin/accounts/" + cookId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recipes").value(1));

        mvc.perform(get("/api/admin/accounts/" + cookId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNotFound());

        // The token outlives the row it names; the recipe must not.
        mvc.perform(get("/api/recipes/" + owned)
                        .header("Authorization", "Bearer " + cookToken))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void deletingAnOwnerDoesNotDeleteEverybodyElsesWeek() throws Exception {
        // This is the trap. `households.owner_user_id` cascades from `users`,
        // and `planned_meals.household_id` cascades from `households` — so
        // deleting an owner would take away every meal every *member* put on
        // that week, silently, on behalf of somebody who only asked to erase
        // their own account.
        mvc.perform(post("/api/admin/accounts/" + cookId + "/tier")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"tier":"FAMILY"}"""))
                .andExpect(status().isOk());

        // The household row is made on demand, the first time the plan is
        // touched. An invitation needs it to exist.
        mvc.perform(get("/api/household").header("Authorization", "Bearer " + cookToken))
                .andExpect(status().isOk());

        String memberEmail = "member-%d@fuelr.test".formatted(System.nanoTime());
        String memberToken = json.readTree(register(memberEmail)).get("token").asText();

        // Minted here rather than read from a response: the raw token only
        // ever exists in the email, which is the point of storing a hash.
        String token = OneTimeToken.mint();
        long householdId = households.findByOwnerUserId(cookId).orElseThrow().getId();
        invitations.save(new HouseholdInvitation(
                householdId, memberEmail, OneTimeToken.hash(token),
                // Any future instant: this test is not about the lifetime.
                Instant.now().plus(Duration.ofHours(1))));

        mvc.perform(post("/api/household/join")
                        .header("Authorization", "Bearer " + memberToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"token":"%s"}""".formatted(token)))
                .andExpect(status().isOk());

        // The member plans their own evening on the shared week.
        long theirRecipe = recipe(memberToken, "Dahl du membre");
        mvc.perform(post("/api/plan")
                        .header("Authorization", "Bearer " + memberToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"date":"2026-03-05","slot":"DINNER","recipeId":%d}"""
                                .formatted(theirRecipe)))
                .andExpect(status().isCreated());

        // The operator is told what will happen before it happens.
        mvc.perform(get("/api/admin/accounts/" + cookId + "/deletion-preview")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(jsonPath("$.householdHandedOver").value(true))
                .andExpect(jsonPath("$.newOwnerEmail").value(memberEmail));

        mvc.perform(delete("/api/admin/accounts/" + cookId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.householdHandedOver").value(true));

        // And their week is still there.
        mvc.perform(get("/api/plan").param("week", "2026-03-02")
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.meals.length()").value(1))
                .andExpect(jsonPath("$.meals[0].title").value("Dahl du membre"));
    }

    @Test
    void anOperatorCannotDeleteThemselvesFromInsideThePanel() throws Exception {
        long adminId = json.readTree(
                mvc.perform(get("/api/admin/accounts").param("q", "panel-admin@fuelr.test")
                                .header("Authorization", "Bearer " + adminToken))
                        .andReturn().getResponse().getContentAsString())
                .get(0).get("id").asLong();

        // Locking the installation out of its own panel, from inside it.
        mvc.perform(delete("/api/admin/accounts/" + adminId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isConflict());
    }

    // --- the figures --------------------------------------------------------

    @Test
    void theSubscriptionFiguresCountPlansAndSayNothingWasCollected() throws Exception {
        mvc.perform(post("/api/admin/accounts/" + cookId + "/tier")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"tier":"PLUS"}"""))
                .andExpect(status().isOk());

        mvc.perform(get("/api/admin/subscriptions")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)))
                // Nothing has been paid: every plan here was granted, and a
                // theoretical figure shown as received is how a dashboard
                // starts lying.
                .andExpect(jsonPath("$.anyPaymentEverCollected").value(false))
                .andExpect(jsonPath("$.monthlyCommittedCents")
                        .value(org.hamcrest.Matchers.greaterThan(0)))
                .andExpect(jsonPath("$.currency").isNotEmpty());
    }

    @Test
    void theUsageFiguresCountRowsAndNameNobody() throws Exception {
        recipe(cookToken, "Curry");

        String body = mvc.perform(get("/api/admin/usage")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.counts.length()").value(12))
                .andReturn().getResponse().getContentAsString();

        // Not one address, not one identifier: this section is totals, and the
        // privacy page says this application measures nobody.
        assertThat(body).doesNotContain("@fuelr.test");
        assertThat(json.readTree(body).get("counts").get(0).has("what")).isTrue();
    }
}
