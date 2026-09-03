package ch.celestin.fuelr.log;

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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class MealLogApiTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17");

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String token;

    @BeforeEach
    void signIn() throws Exception {
        String response = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"journal-%d@fuelr.app","name":"Chef","password":"motdepasse123"}"""
                                .formatted(System.nanoTime())))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        token = json.readTree(response).get("token").asText();
    }

    private void subscribe() throws Exception {
        mvc.perform(post("/api/subscription/orders")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"tier":"PLUS"}"""))
                .andExpect(status().isAccepted());
    }

    private long recipe() throws Exception {
        String created = mvc.perform(post("/api/recipes").header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(created).get("id").asLong();
        mvc.perform(put("/api/recipes/" + id)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Curry","servings":4,
                                 "ingredients":[{"name":"Lentilles","quantity":400,"unit":"g"}],
                                 "steps":["Cuire 20 min."]}"""))
                .andExpect(status().isOk());
        return id;
    }

    private String today() {
        return java.time.LocalDate.now().toString();
    }

    // --- writing it down ----------------------------------------------------

    @Test
    void aMealAtARestaurantNeedsNoRecipe() throws Exception {
        mvc.perform(post("/api/log")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"date":"%s","slot":"DINNER","title":"Pizza chez Luigi","kcal":900}"""
                                .formatted(today())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Pizza chez Luigi"))
                .andExpect(jsonPath("$.kcal").value(900.0))
                .andExpect(jsonPath("$.source").value("FREE"))
                // Typed by hand, so it is somebody's estimate by definition.
                .andExpect(jsonPath("$.estimated").value(true));
    }

    @Test
    void anEntryWithNothingToCallItIsRefused() throws Exception {
        mvc.perform(post("/api/log")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"date":"%s","kcal":500}""".formatted(today())))
                .andExpect(status().isBadRequest());
    }

    @Test
    void aLoggedRecipeCopiesItsFiguresAndStopsFollowingIt() throws Exception {
        long curry = recipe();
        mvc.perform(post("/api/log")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"date":"%s","slot":"DINNER","recipeId":%d,"servings":1}"""
                                .formatted(today(), curry)))
                .andExpect(status().isCreated());

        String before = mvc.perform(get("/api/log").header("Authorization", "Bearer " + token))
                .andReturn().getResponse().getContentAsString();
        double logged = json.readTree(before).get("entries").get(0).get("kcal").asDouble();
        assertThat(logged).isGreaterThan(0);

        // The recipe is corrected afterwards — ten times the lentils.
        mvc.perform(put("/api/recipes/" + curry)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Curry","servings":4,
                                 "ingredients":[{"name":"Lentilles","quantity":4000,"unit":"g"}],
                                 "steps":["Cuire 20 min."]}"""))
                .andExpect(status().isOk());

        String after = mvc.perform(get("/api/log").header("Authorization", "Bearer " + token))
                .andReturn().getResponse().getContentAsString();
        // What was eaten in the past does not change because a recipe did.
        assertThat(json.readTree(after).get("entries").get(0).get("kcal").asDouble())
                .isEqualTo(logged);
    }

    @Test
    void deletingTheRecipeLeavesTheHistoryStanding() throws Exception {
        long curry = recipe();
        mvc.perform(post("/api/log")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"date":"%s","slot":"DINNER","recipeId":%d,"servings":1}"""
                                .formatted(today(), curry)))
                .andExpect(status().isCreated());

        mvc.perform(delete("/api/recipes/" + curry).header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/log").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.entries.length()").value(1))
                .andExpect(jsonPath("$.entries[0].title").value("Curry"));
    }

    @Test
    void undoingADeleteBringsBackTheFiguresThatWereDeleted() throws Exception {
        long curry = recipe();
        mvc.perform(post("/api/log")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"date":"%s","slot":"DINNER","recipeId":%d,"servings":1}"""
                                .formatted(today(), curry)))
                .andExpect(status().isCreated());

        String week = mvc.perform(get("/api/log").header("Authorization", "Bearer " + token))
                .andReturn().getResponse().getContentAsString();
        var entry = json.readTree(week).get("entries").get(0);
        double kcal = entry.get("kcal").asDouble();

        mvc.perform(delete("/api/log/" + entry.get("id").asLong())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        // The recipe is corrected while the undo is still on screen. A restore
        // that recomputed would hand back a different meal than the one that
        // was removed — which is the whole reason it does not.
        mvc.perform(put("/api/recipes/" + curry)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Curry","servings":4,
                                 "ingredients":[{"name":"Lentilles","quantity":4000,"unit":"g"}],
                                 "steps":["Cuire 20 min."]}"""))
                .andExpect(status().isOk());

        mvc.perform(post("/api/log/restore")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"date":"%s","slot":"DINNER","title":"Curry","servings":1,
                                 "kcal":%s,"proteinG":%s,"carbsG":%s,"fatG":%s,
                                 "estimated":%s,"source":"RECIPE","recipeId":%d}"""
                                .formatted(today(), kcal,
                                        entry.get("proteinG").asDouble(),
                                        entry.get("carbsG").asDouble(),
                                        entry.get("fatG").asDouble(),
                                        entry.get("estimated").asBoolean(), curry)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.kcal").value(kcal))
                .andExpect(jsonPath("$.source").value("RECIPE"));

        mvc.perform(get("/api/log").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.entries.length()").value(1))
                .andExpect(jsonPath("$.entries[0].kcal").value(kcal));
    }

    @Test
    void aRestoredEntryIsNobodyElsesToRestore() throws Exception {
        mvc.perform(post("/api/log/restore")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"date":"%s","title":"Pizza","kcal":900,"estimated":true}"""
                                .formatted(today())))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void cookingAPlannedMealWritesItDownOnceForWhoeverCookedIt() throws Exception {
        long curry = recipe();
        String created = mvc.perform(post("/api/plan")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"date":"%s","slot":"DINNER","recipeId":%d,"servings":4}"""
                                .formatted(today(), curry)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long meal = json.readTree(created).get("id").asLong();

        mvc.perform(post("/api/plan/" + meal + "/cooked")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        // Clicking twice is a click, not a second dinner.
        mvc.perform(post("/api/plan/" + meal + "/cooked")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        mvc.perform(get("/api/log").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.entries.length()").value(1))
                .andExpect(jsonPath("$.entries[0].source").value("PLAN"))
                // One share of a dinner for four, not the whole pot.
                .andExpect(jsonPath("$.entries[0].servings").value(1.0));
    }

    // --- targets and findings -----------------------------------------------

    @Test
    void theDiaryIsFreeAndTheTargetBesideItIsNot() throws Exception {
        mvc.perform(post("/api/log")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"date":"%s","title":"Sandwich","kcal":600}""".formatted(today())))
                .andExpect(status().isCreated());

        mvc.perform(get("/api/log").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                // Written down and read back, on the free plan.
                .andExpect(jsonPath("$.entries.length()").value(1))
                .andExpect(jsonPath("$.days.length()").value(7))
                .andExpect(jsonPath("$.tracking").value(false))
                .andExpect(jsonPath("$.targets").doesNotExist())
                .andExpect(jsonPath("$.insights").isEmpty());

        mvc.perform(put("/api/log/targets")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"kcal":2200,"proteinG":110,"carbsG":250,"fatG":70}"""))
                .andExpect(status().isPaymentRequired());
    }

    @Test
    void withThePlanTheWeekCarriesATargetAndFindings() throws Exception {
        subscribe();
        mvc.perform(put("/api/log/targets")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"kcal":2000,"proteinG":100,"carbsG":250,"fatG":70}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.chosen").value(true));

        mvc.perform(post("/api/log")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"date":"%s","title":"Sandwich","kcal":600,"proteinG":20}"""
                                .formatted(today())))
                .andExpect(status().isCreated());

        String response = mvc.perform(get("/api/log").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.tracking").value(true))
                .andExpect(jsonPath("$.targets.kcal").value(2000))
                .andReturn().getResponse().getContentAsString();

        var codes = new java.util.ArrayList<String>();
        json.readTree(response).get("insights").forEach(i -> codes.add(i.get("code").asText()));
        // The week is one day old, and the screen says so before it says
        // anything about a gap.
        assertThat(codes).contains("PARTIAL_WEEK", "ENERGY_VS_TARGET");
        // Nothing that congratulates, blames, or counts a streak.
        assertThat(codes).doesNotContain("STREAK");
    }

    @Test
    void anAverageIsOverTheDaysThatWereWrittenDown() throws Exception {
        subscribe();
        mvc.perform(post("/api/log")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"date":"%s","title":"Sandwich","kcal":600}""".formatted(today())))
                .andExpect(status().isCreated());

        mvc.perform(get("/api/log").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.loggedDays").value(1))
                // 600 over one day, not 600 spread over seven: a blank day is
                // a day nobody wrote down, not a day of eating nothing.
                .andExpect(jsonPath("$.average.kcal").value(600.0));
    }

    // --- how far back -------------------------------------------------------

    @Test
    void theFreePlanKeepsASlidingWindowAndSaysSo() throws Exception {
        String old = java.time.LocalDate.now().minusDays(200).toString();

        mvc.perform(get("/api/log/history?from=" + old)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.windowed").value(true))
                .andExpect(jsonPath("$.windowDays").value(LogService.FREE_WINDOW_DAYS));

        subscribe();
        mvc.perform(get("/api/log/history?from=" + old)
                        .header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.windowed").value(false))
                .andExpect(jsonPath("$.from").value(old));
    }

    @Test
    void theWindowHidesNothingItCannotGiveBack() throws Exception {
        String old = java.time.LocalDate.now().minusDays(120).toString();
        mvc.perform(post("/api/log")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"date":"%s","title":"Vieux repas","kcal":700}""".formatted(old)))
                .andExpect(status().isCreated());

        // Out of the free window, and still the earliest thing on record.
        mvc.perform(get("/api/log/history").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.earliest").value(old));

        subscribe();
        mvc.perform(get("/api/log/history?from=" + old)
                        .header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.days[0].kcal").value(700.0));
    }

    @Test
    void theLogIsNotPublic() throws Exception {
        mvc.perform(get("/api/log")).andExpect(status().isUnauthorized());
    }
}
