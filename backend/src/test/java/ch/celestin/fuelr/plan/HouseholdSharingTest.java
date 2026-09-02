package ch.celestin.fuelr.plan;

import ch.celestin.fuelr.auth.OneTimeToken;
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

import java.time.Instant;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * One plan, several accounts — and everything that must survive the plan being
 * cancelled.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class HouseholdSharingTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17");

    private static final String MONDAY = "2026-03-02";
    private static final String WEDNESDAY = "2026-03-04";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired HouseholdInvitationRepository invitations;
    @Autowired HouseholdRepository households;

    /** An account, as a token and an id. */
    private record Account(String token, long id) {
    }

    private Account owner;
    private Account guest;

    @BeforeEach
    void signIn() throws Exception {
        owner = register();
        guest = register();
    }

    private Account register() throws Exception {
        String response = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"foyer-%d@fuelr.app","name":"Chef %1$d","password":"motdepasse123"}"""
                                .formatted(System.nanoTime())))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        var body = json.readTree(response);
        return new Account(body.get("token").asText(), body.get("user").get("id").asLong());
    }

    private void subscribeToFamily(Account account) throws Exception {
        mvc.perform(post("/api/subscription/orders")
                        .header("Authorization", "Bearer " + account.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"tier":"FAMILY"}"""))
                .andExpect(status().isAccepted());
    }

    private long recipe(Account account, String title) throws Exception {
        String created = mvc.perform(post("/api/recipes")
                        .header("Authorization", "Bearer " + account.token()))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(created).get("id").asLong();
        mvc.perform(put("/api/recipes/" + id)
                        .header("Authorization", "Bearer " + account.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"%s","servings":4,
                                 "ingredients":[{"name":"Lentilles","quantity":200,"unit":"g"}],
                                 "steps":["Cuire 20 min."]}""".formatted(title)))
                .andExpect(status().isOk());
        return id;
    }

    private void plan(Account account, String date, String slot, long recipeId) throws Exception {
        mvc.perform(post("/api/plan")
                        .header("Authorization", "Bearer " + account.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"date":"%s","slot":"%s","recipeId":%d}"""
                                .formatted(date, slot, recipeId)))
                .andExpect(status().isCreated());
    }

    /**
     * Mints an invitation the way the service does. The raw token only ever
     * exists in the email, so a test that needs one makes its own.
     */
    private String invitationTokenFor(Account host) throws Exception {
        String token = OneTimeToken.mint();
        long householdId = households.findByOwnerUserId(host.id()).orElseThrow().getId();
        invitations.save(new HouseholdInvitation(
                householdId, "guest@fuelr.app", OneTimeToken.hash(token),
                Instant.now().plus(HouseholdService.INVITATION_LIFETIME)));
        return token;
    }

    private void join(Account account, String token) throws Exception {
        mvc.perform(post("/api/household/join")
                        .header("Authorization", "Bearer " + account.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"token":"%s"}""".formatted(token)))
                .andExpect(status().isOk());
    }

    /** Owner on Famille, guest inside the household, one meal on Wednesday. */
    private long share() throws Exception {
        subscribeToFamily(owner);
        // The household has to exist before it can be invited into.
        mvc.perform(get("/api/household").header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isOk());
        join(guest, invitationTokenFor(owner));
        long curry = recipe(owner, "Curry du foyer");
        plan(owner, WEDNESDAY, "DINNER", curry);
        return curry;
    }

    // --- the paywall --------------------------------------------------------

    @Test
    void invitingWithoutTheFamilyPlanSaysWhichPlanOpensIt() throws Exception {
        mvc.perform(post("/api/household/invitations")
                        .header("Authorization", "Bearer " + owner.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"quelquun@fuelr.app","locale":"fr"}"""))
                // 402, not 403: nothing is wrong with the account, and the way
                // past it is a plan rather than a permission.
                .andExpect(status().isPaymentRequired())
                .andExpect(jsonPath("$.error").value("upgrade_required"))
                .andExpect(jsonPath("$.requiredTier").value("FAMILY"));
    }

    @Test
    void withTheFamilyPlanTheInvitationIsSentAndListedForTheOwnerOnly() throws Exception {
        subscribeToFamily(owner);

        mvc.perform(post("/api/household/invitations")
                        .header("Authorization", "Bearer " + owner.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"quelquun@fuelr.app","locale":"fr"}"""))
                .andExpect(status().isAccepted());

        mvc.perform(get("/api/household").header("Authorization", "Bearer " + owner.token()))
                .andExpect(jsonPath("$.sharingOpen").value(true))
                .andExpect(jsonPath("$.invitations.length()").value(1))
                .andExpect(jsonPath("$.invitations[0].email").value("quelquun@fuelr.app"));

        // A member has no business seeing who else was asked.
        join(guest, invitationTokenFor(owner));
        mvc.perform(get("/api/household").header("Authorization", "Bearer " + guest.token()))
                .andExpect(jsonPath("$.owner").value(false))
                .andExpect(jsonPath("$.invitations").isEmpty());
    }

    // --- one plan, two people -----------------------------------------------

    @Test
    void whatOneMemberPlansTheOtherSees() throws Exception {
        share();

        mvc.perform(get("/api/plan?week=" + MONDAY)
                        .header("Authorization", "Bearer " + guest.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.shared").value(true))
                .andExpect(jsonPath("$.accounts").value(2))
                .andExpect(jsonPath("$.meals.length()").value(1))
                .andExpect(jsonPath("$.meals[0].title").value("Curry du foyer"))
                // Somebody else's doing is named; one's own is not.
                .andExpect(jsonPath("$.meals[0].plannedBy").isNotEmpty());

        long saumon = recipe(guest, "Saumon du foyer");
        plan(guest, "2026-03-05", "DINNER", saumon);

        mvc.perform(get("/api/plan?week=" + MONDAY)
                        .header("Authorization", "Bearer " + owner.token()))
                .andExpect(jsonPath("$.meals.length()").value(2));
    }

    @Test
    void aMemberCanMoveAndRemoveWhatSomebodyElsePlanned() throws Exception {
        share();
        String response = mvc.perform(get("/api/plan?week=" + MONDAY)
                        .header("Authorization", "Bearer " + guest.token()))
                .andReturn().getResponse().getContentAsString();
        long mealId = json.readTree(response).get("meals").get(0).get("id").asLong();

        mvc.perform(put("/api/plan/" + mealId)
                        .header("Authorization", "Bearer " + guest.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"date":"%s","slot":"LUNCH"}""".formatted(MONDAY)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.date").value(MONDAY));

        mvc.perform(delete("/api/plan/" + mealId)
                        .header("Authorization", "Bearer " + guest.token()))
                .andExpect(status().isNoContent());
    }

    @Test
    void aRecipeOnTheSharedPlanCanBeReadButNotRewritten() throws Exception {
        long curry = share();
        long unplanned = recipe(owner, "Recette gardée pour moi");

        mvc.perform(get("/api/recipes/" + curry)
                        .header("Authorization", "Bearer " + guest.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Curry du foyer"));

        // Sharing a plan is not sharing a library.
        mvc.perform(get("/api/recipes/" + unplanned)
                        .header("Authorization", "Bearer " + guest.token()))
                .andExpect(status().isNotFound());

        // And it is read access, never write.
        mvc.perform(put("/api/recipes/" + curry)
                        .header("Authorization", "Bearer " + guest.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Détourné"}"""))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/recipes/" + curry)
                        .header("Authorization", "Bearer " + guest.token()))
                .andExpect(status().isNotFound());

        // The shared plan is not in the guest's own library either.
        mvc.perform(get("/api/recipes").header("Authorization", "Bearer " + guest.token()))
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void everyMemberKeepsTheirOwnNutritionProfile() throws Exception {
        share();

        mvc.perform(put("/api/profile")
                        .header("Authorization", "Bearer " + owner.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"age":40,"sex":"MALE","heightCm":180,"weightKg":80,
                                 "activity":"MODERATE","goal":"MAINTAIN"}"""))
                .andExpect(status().isOk());
        mvc.perform(put("/api/profile")
                        .header("Authorization", "Bearer " + guest.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"age":30,"sex":"FEMALE","heightCm":165,"weightKg":58,
                                 "activity":"LIGHT","goal":"LOSE"}"""))
                .andExpect(status().isOk());

        // Sharing a plan does not merge two bodies into one target.
        mvc.perform(get("/api/profile").header("Authorization", "Bearer " + owner.token()))
                .andExpect(jsonPath("$.profile.age").value(40));
        mvc.perform(get("/api/profile").header("Authorization", "Bearer " + guest.token()))
                .andExpect(jsonPath("$.profile.age").value(30));
    }

    // --- leaving, and losing the plan ---------------------------------------

    @Test
    void leavingPutsSomeoneBackInFrontOfTheirOwnPlan() throws Exception {
        share();

        mvc.perform(post("/api/household/leave")
                        .header("Authorization", "Bearer " + guest.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.owner").value(true));

        mvc.perform(get("/api/plan?week=" + MONDAY)
                        .header("Authorization", "Bearer " + guest.token()))
                .andExpect(jsonPath("$.meals").isEmpty());
        // And the household they left is untouched.
        mvc.perform(get("/api/plan?week=" + MONDAY)
                        .header("Authorization", "Bearer " + owner.token()))
                .andExpect(jsonPath("$.meals.length()").value(1));
    }

    @Test
    void theOwnerCanShowSomeoneOutAndAMemberCannot() throws Exception {
        share();

        mvc.perform(delete("/api/household/members/" + owner.id())
                        .header("Authorization", "Bearer " + guest.token()))
                .andExpect(status().isNotFound());

        mvc.perform(delete("/api/household/members/" + guest.id())
                        .header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.members.length()").value(1));
    }

    @Test
    void cancellingTheFamilyPlanLosesNothing() throws Exception {
        share();

        mvc.perform(delete("/api/subscription")
                        .header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isOk());

        // The guest is back on their own plan, which is empty and always was.
        mvc.perform(get("/api/plan?week=" + MONDAY)
                        .header("Authorization", "Bearer " + guest.token()))
                .andExpect(jsonPath("$.shared").value(false))
                .andExpect(jsonPath("$.meals").isEmpty());
        // The owner keeps every meal: the household is theirs either way.
        mvc.perform(get("/api/plan?week=" + MONDAY)
                        .header("Authorization", "Bearer " + owner.token()))
                .andExpect(jsonPath("$.meals.length()").value(1));

        // Subscribing again puts the guest back where they were. Nothing was
        // deleted, so nothing has to be rebuilt.
        subscribeToFamily(owner);
        mvc.perform(get("/api/plan?week=" + MONDAY)
                        .header("Authorization", "Bearer " + guest.token()))
                .andExpect(jsonPath("$.shared").value(true))
                .andExpect(jsonPath("$.meals.length()").value(1));
    }

    // --- invitations that do not work ---------------------------------------

    @Test
    void anInvitationWorksOnceAndOnlyWhileTheHouseholdIsShared() throws Exception {
        subscribeToFamily(owner);
        mvc.perform(get("/api/household").header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isOk());
        String token = invitationTokenFor(owner);
        join(guest, token);

        Account second = register();
        mvc.perform(post("/api/household/join")
                        .header("Authorization", "Bearer " + second.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"token":"%s"}""".formatted(token)))
                .andExpect(status().isGone());

        // A fresh link into a household that is no longer paying for sharing
        // is just as dead — the invitation is not the entitlement.
        String fresh = invitationTokenFor(owner);
        mvc.perform(delete("/api/subscription")
                        .header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isOk());
        mvc.perform(post("/api/household/join")
                        .header("Authorization", "Bearer " + second.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"token":"%s"}""".formatted(fresh)))
                .andExpect(status().isGone());
    }

    @Test
    void aHouseholdHoldsSixAccountsAndSaysSoRatherThanQuietlyDropping() throws Exception {
        subscribeToFamily(owner);
        mvc.perform(get("/api/household").header("Authorization", "Bearer " + owner.token()))
                .andExpect(status().isOk());

        // The owner is one of the six, so five more fit.
        for (int i = 0; i < HouseholdService.MAX_ACCOUNTS - 1; i++) {
            join(register(), invitationTokenFor(owner));
        }

        String token = invitationTokenFor(owner);
        mvc.perform(post("/api/household/join")
                        .header("Authorization", "Bearer " + register().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"token":"%s"}""".formatted(token)))
                .andExpect(status().isConflict());

        mvc.perform(post("/api/household/invitations")
                        .header("Authorization", "Bearer " + owner.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"septieme@fuelr.app"}"""))
                .andExpect(status().isConflict());
    }

    @Test
    void theHouseholdIsNotPublic() throws Exception {
        mvc.perform(get("/api/household")).andExpect(status().isUnauthorized());
    }
}
