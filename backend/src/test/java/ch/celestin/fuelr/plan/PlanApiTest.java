package ch.celestin.fuelr.plan;

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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class PlanApiTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17");

    /** A Monday, so nothing in these tests depends on the day they run. */
    private static final String MONDAY = "2026-03-02";
    private static final String WEDNESDAY = "2026-03-04";
    private static final String NEXT_MONDAY = "2026-03-09";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String token;

    @BeforeEach
    void signIn() throws Exception {
        token = register("plan-" + System.nanoTime() + "@fuelr.app");
    }

    private String register(String email) throws Exception {
        String response = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","name":"Chef","password":"motdepasse123"}"""
                                .formatted(email)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("token").asText();
    }

    /** A published recipe for four, with one ingredient the scaling can be read on. */
    private long recipe(String asToken, String title) throws Exception {
        String created = mvc.perform(post("/api/recipes").header("Authorization", "Bearer " + asToken))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(created).get("id").asLong();
        mvc.perform(put("/api/recipes/" + id)
                        .header("Authorization", "Bearer " + asToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"%s","servings":4,
                                 "ingredients":[{"name":"Lentilles","quantity":200,"unit":"g"}],
                                 "steps":["Cuire 20 min."]}""".formatted(title)))
                .andExpect(status().isOk());
        return id;
    }

    private long plan(String date, String slot, long recipeId, Integer servings) throws Exception {
        String body = servings == null
                ? """
                  {"date":"%s","slot":"%s","recipeId":%d}""".formatted(date, slot, recipeId)
                : """
                  {"date":"%s","slot":"%s","recipeId":%d,"servings":%d}"""
                        .formatted(date, slot, recipeId, servings);
        String response = mvc.perform(post("/api/plan")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("id").asLong();
    }

    // --- the week grid ------------------------------------------------------

    @Test
    void anEmptyWeekIsSevenEmptyDays() throws Exception {
        mvc.perform(get("/api/plan?week=" + WEDNESDAY).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                // Any day inside the week names the week; the Monday comes back.
                .andExpect(jsonPath("$.weekStart").value(MONDAY))
                .andExpect(jsonPath("$.meals").isEmpty())
                .andExpect(jsonPath("$.days.length()").value(7))
                .andExpect(jsonPath("$.days[0].meals").value(0))
                // Nothing planned is not zero calories, it is no figure at all.
                .andExpect(jsonPath("$.days[0].kcal").doesNotExist());
    }

    @Test
    void placingARecipeFillsOneSlotAndLeavesTheRestAlone() throws Exception {
        long curry = recipe(token, "Curry de lentilles");

        plan(WEDNESDAY, "DINNER", curry, null);

        mvc.perform(get("/api/plan?week=" + MONDAY).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.meals.length()").value(1))
                .andExpect(jsonPath("$.meals[0].date").value(WEDNESDAY))
                .andExpect(jsonPath("$.meals[0].slot").value("DINNER"))
                .andExpect(jsonPath("$.meals[0].title").value("Curry de lentilles"))
                .andExpect(jsonPath("$.days[2].meals").value(1))
                .andExpect(jsonPath("$.days[0].meals").value(0));
    }

    @Test
    void aRecipeThatIsNotYoursCannotBePlanned() throws Exception {
        String other = register("other-" + System.nanoTime() + "@fuelr.app");
        long theirs = recipe(other, "Leur recette");

        mvc.perform(post("/api/plan")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"date":"%s","slot":"DINNER","recipeId":%d}"""
                                .formatted(WEDNESDAY, theirs)))
                .andExpect(status().isNotFound());
    }

    // --- portions -----------------------------------------------------------

    @Test
    void portionsFollowTheHouseholdRatherThanTheRecipe() throws Exception {
        long curry = recipe(token, "Curry");
        mvc.perform(put("/api/plan/household")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"size":3}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(3));

        plan(WEDNESDAY, "DINNER", curry, null);

        mvc.perform(get("/api/plan?week=" + MONDAY).header("Authorization", "Bearer " + token))
                // The recipe is written for four; the household is three.
                .andExpect(jsonPath("$.meals[0].servings").value(3))
                .andExpect(jsonPath("$.meals[0].recipeServings").value(4))
                .andExpect(jsonPath("$.householdSize").value(3));
    }

    @Test
    void changingAMealsPortionsChangesWhatItNeedsBought() throws Exception {
        long curry = recipe(token, "Curry");
        long meal = plan(WEDNESDAY, "DINNER", curry, 4);

        mvc.perform(get("/api/plan/ingredients?week=" + MONDAY)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Lentilles"))
                .andExpect(jsonPath("$[0].quantity").value(200.0));

        mvc.perform(put("/api/plan/" + meal)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"servings":6}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.servings").value(6));

        // Six people out of a recipe for four: half as much again.
        mvc.perform(get("/api/plan/ingredients?week=" + MONDAY)
                        .header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$[0].quantity").value(300.0));
    }

    @Test
    void changingTheHouseholdLeavesMealsAlreadyPlannedAlone() throws Exception {
        long curry = recipe(token, "Curry");
        plan(WEDNESDAY, "DINNER", curry, 8);

        mvc.perform(put("/api/plan/household")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"size":2}"""))
                .andExpect(status().isOk());

        mvc.perform(get("/api/plan?week=" + MONDAY).header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.meals[0].servings").value(8));
    }

    // --- moving and removing ------------------------------------------------

    @Test
    void aMealMovesToAnotherDayWithoutBeingTypedAgain() throws Exception {
        long curry = recipe(token, "Curry");
        long meal = plan(WEDNESDAY, "DINNER", curry, 4);

        mvc.perform(put("/api/plan/" + meal)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"date":"%s","slot":"LUNCH"}""".formatted(MONDAY)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.date").value(MONDAY))
                .andExpect(jsonPath("$.slot").value("LUNCH"))
                // Untouched fields survive the move.
                .andExpect(jsonPath("$.servings").value(4))
                .andExpect(jsonPath("$.title").value("Curry"));
    }

    @Test
    void removingAMealEmptiesItsSlotAndItsShoppingLines() throws Exception {
        long curry = recipe(token, "Curry");
        long meal = plan(WEDNESDAY, "DINNER", curry, 4);

        mvc.perform(delete("/api/plan/" + meal).header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/plan?week=" + MONDAY).header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.meals").isEmpty());
        mvc.perform(get("/api/plan/ingredients?week=" + MONDAY)
                        .header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void someoneElsesPlannedMealIsReportedAsMissing() throws Exception {
        long curry = recipe(token, "Curry");
        long meal = plan(WEDNESDAY, "DINNER", curry, 4);
        String other = register("other-" + System.nanoTime() + "@fuelr.app");

        mvc.perform(delete("/api/plan/" + meal).header("Authorization", "Bearer " + other))
                .andExpect(status().isNotFound());
    }

    @Test
    void deletingARecipeTakesItsPlannedMealsWithIt() throws Exception {
        long curry = recipe(token, "Curry");
        plan(WEDNESDAY, "DINNER", curry, 4);

        mvc.perform(delete("/api/recipes/" + curry).header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/plan?week=" + MONDAY).header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.meals").isEmpty());
    }

    // --- duplicating a week -------------------------------------------------

    @Test
    void aWeekCopiesForwardWithItsDaysAndPortions() throws Exception {
        long curry = recipe(token, "Curry");
        plan(WEDNESDAY, "DINNER", curry, 6);

        mvc.perform(post("/api/plan/copy")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"from":"%s","to":"%s","replace":false}"""
                                .formatted(MONDAY, NEXT_MONDAY)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weekStart").value(NEXT_MONDAY))
                .andExpect(jsonPath("$.meals.length()").value(1))
                // Same weekday, same slot, same servings.
                .andExpect(jsonPath("$.meals[0].date").value("2026-03-11"))
                .andExpect(jsonPath("$.meals[0].slot").value("DINNER"))
                .andExpect(jsonPath("$.meals[0].servings").value(6));

        // The week it came from is untouched.
        mvc.perform(get("/api/plan?week=" + MONDAY).header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.meals.length()").value(1));
    }

    @Test
    void copyingRefusesToSilentlyOverwriteAWeekAlreadyPlanned() throws Exception {
        long curry = recipe(token, "Curry");
        plan(WEDNESDAY, "DINNER", curry, 4);
        plan(NEXT_MONDAY, "LUNCH", curry, 4);

        mvc.perform(post("/api/plan/copy")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"from":"%s","to":"%s","replace":false}"""
                                .formatted(MONDAY, NEXT_MONDAY)))
                .andExpect(status().isConflict());

        // Said out loud, it goes through and the target is replaced, not added to.
        mvc.perform(post("/api/plan/copy")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"from":"%s","to":"%s","replace":true}"""
                                .formatted(MONDAY, NEXT_MONDAY)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.meals.length()").value(1))
                .andExpect(jsonPath("$.meals[0].date").value("2026-03-11"));
    }

    // --- access -------------------------------------------------------------

    @Test
    void thePlanIsNotPublic() throws Exception {
        mvc.perform(get("/api/plan")).andExpect(status().isUnauthorized());
    }
}
