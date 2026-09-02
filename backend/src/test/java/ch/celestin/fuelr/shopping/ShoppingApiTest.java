package ch.celestin.fuelr.shopping;

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
class ShoppingApiTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17");

    private static final String MONDAY = "2026-03-02";
    private static final String WEDNESDAY = "2026-03-04";
    private static final String THURSDAY = "2026-03-05";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String token;

    @BeforeEach
    void signIn() throws Exception {
        String response = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"courses-%d@fuelr.app","name":"Chef","password":"motdepasse123"}"""
                                .formatted(System.nanoTime())))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        token = json.readTree(response).get("token").asText();
    }

    /** A recipe for four, with the ingredients each test needs to see. */
    private long recipe(String title, String ingredients) throws Exception {
        String created = mvc.perform(post("/api/recipes").header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(created).get("id").asLong();
        mvc.perform(put("/api/recipes/" + id)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"%s","servings":4,"ingredients":[%s],
                                 "steps":["Cuire 20 min."]}""".formatted(title, ingredients)))
                .andExpect(status().isOk());
        return id;
    }

    /** Planned for four, so the quantities are the recipe's own. */
    private long plan(String date, String slot, long recipeId) throws Exception {
        String response = mvc.perform(post("/api/plan")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"date":"%s","slot":"%s","recipeId":%d,"servings":4}"""
                                .formatted(date, slot, recipeId)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("id").asLong();
    }

    private com.fasterxml.jackson.databind.JsonNode list() throws Exception {
        return json.readTree(mvc.perform(get("/api/shopping?week=" + MONDAY)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }

    /** The first line whose name matches, wherever its aisle put it. */
    private com.fasterxml.jackson.databind.JsonNode line(String name) throws Exception {
        for (var aisle : list().get("aisles")) {
            for (var item : aisle.get("items")) {
                if (item.get("name").asText().equalsIgnoreCase(name)) return item;
            }
        }
        return null;
    }

    // --- generating ---------------------------------------------------------

    @Test
    void anEmptyWeekBuysNothing() throws Exception {
        mvc.perform(get("/api/shopping?week=" + MONDAY).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weekStart").value(MONDAY))
                .andExpect(jsonPath("$.aisles").isEmpty())
                .andExpect(jsonPath("$.remaining").value(0));
    }

    @Test
    void theSameIngredientInTwoMealsIsOneLine() throws Exception {
        long curry = recipe("Curry", """
                {"name":"Lentilles","quantity":200,"unit":"g"}""");
        plan(WEDNESDAY, "DINNER", curry);
        plan(THURSDAY, "DINNER", curry);

        // Two evenings, one line, 400 g — not two lines of 200.
        var lentilles = line("Lentilles");
        assert lentilles != null;
        mvc.perform(get("/api/shopping?week=" + MONDAY).header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.remaining").value(1));
        org.assertj.core.api.Assertions.assertThat(lentilles.get("quantity").asDouble())
                .isEqualTo(400.0);
    }

    @Test
    void theSameNameInTwoUnitsStaysTwoLines() throws Exception {
        long recipe = recipe("Mélange", """
                {"name":"Tomate","quantity":400,"unit":"g"},
                {"name":"Tomate","quantity":2,"unit":"pcs"}""");
        plan(WEDNESDAY, "DINNER", recipe);

        // 400 g and 2 pieces do not add up to anything.
        mvc.perform(get("/api/shopping?week=" + MONDAY).header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.remaining").value(2));
    }

    @Test
    void theListIsGroupedByAisleInTheOrderAShopIsWalked() throws Exception {
        long recipe = recipe("Plat", """
                {"name":"Lentilles","quantity":200,"unit":"g"},
                {"name":"Tomate","quantity":300,"unit":"g"},
                {"name":"Beurre","quantity":20,"unit":"g"}""");
        plan(WEDNESDAY, "DINNER", recipe);

        mvc.perform(get("/api/shopping?week=" + MONDAY).header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.aisles.length()").value(3))
                // Produce, then dairy, then groceries — not alphabetical.
                .andExpect(jsonPath("$.aisles[0].aisle").value("PRODUCE"))
                .andExpect(jsonPath("$.aisles[1].aisle").value("DAIRY"))
                .andExpect(jsonPath("$.aisles[2].aisle").value("GROCERY"));
    }

    @Test
    void anIngredientNobodyHasHeardOfStillGetsALine() throws Exception {
        long recipe = recipe("Plat", """
                {"name":"Sumac","quantity":5,"unit":"g"}""");
        plan(WEDNESDAY, "DINNER", recipe);

        mvc.perform(get("/api/shopping?week=" + MONDAY).header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.aisles[0].aisle").value("OTHER"))
                .andExpect(jsonPath("$.aisles[0].items[0].name").value("Sumac"));
    }

    // --- regenerating -------------------------------------------------------

    @Test
    void regeneratingKeepsTheBoxesAlreadyTicked() throws Exception {
        long curry = recipe("Curry", """
                {"name":"Lentilles","quantity":200,"unit":"g"}""");
        plan(WEDNESDAY, "DINNER", curry);
        long lentilles = line("Lentilles").get("id").asLong();

        mvc.perform(put("/api/shopping/items/" + lentilles)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"checked":true}"""))
                .andExpect(status().isOk());

        // The plan changes under the list: a second meal, more lentils.
        plan(THURSDAY, "DINNER", curry);

        var again = line("Lentilles");
        org.assertj.core.api.Assertions.assertThat(again.get("checked").asBoolean()).isTrue();
        org.assertj.core.api.Assertions.assertThat(again.get("quantity").asDouble()).isEqualTo(400.0);
    }

    @Test
    void aLineTheWeekNoLongerNeedsGoesAway() throws Exception {
        long curry = recipe("Curry", """
                {"name":"Lentilles","quantity":200,"unit":"g"}""");
        long meal = plan(WEDNESDAY, "DINNER", curry);

        mvc.perform(delete("/api/plan/" + meal).header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/shopping?week=" + MONDAY).header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.aisles").isEmpty());
    }

    // --- free items ---------------------------------------------------------

    @Test
    void aFreeItemSurvivesEveryRegenerationAndCanBeRemoved() throws Exception {
        long curry = recipe("Curry", """
                {"name":"Lentilles","quantity":200,"unit":"g"}""");
        plan(WEDNESDAY, "DINNER", curry);

        mvc.perform(post("/api/shopping/items?week=" + MONDAY)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Papier toilette"}"""))
                .andExpect(status().isCreated());

        plan(THURSDAY, "DINNER", curry);
        var paper = line("Papier toilette");
        org.assertj.core.api.Assertions.assertThat(paper).isNotNull();
        org.assertj.core.api.Assertions.assertThat(paper.get("source").asText()).isEqualTo("MANUAL");
        // No recipe, so no amount and no unit — and that is a complete line.
        org.assertj.core.api.Assertions.assertThat(paper.get("quantity").isNull()).isTrue();

        mvc.perform(delete("/api/shopping/items/" + paper.get("id").asLong())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        org.assertj.core.api.Assertions.assertThat(line("Papier toilette")).isNull();
    }

    @Test
    void aLineThatCameFromThePlanIsNotRemovableByHand() throws Exception {
        long curry = recipe("Curry", """
                {"name":"Lentilles","quantity":200,"unit":"g"}""");
        plan(WEDNESDAY, "DINNER", curry);

        // It would be back on the next read; saying so beats pretending.
        mvc.perform(delete("/api/shopping/items/" + line("Lentilles").get("id").asLong())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isConflict());
    }

    // --- the cupboard -------------------------------------------------------

    @Test
    void whatIsAlreadyAtHomeIsDeductedFromWhatToBuy() throws Exception {
        long curry = recipe("Curry", """
                {"name":"Lentilles","quantity":200,"unit":"g"}""");
        plan(WEDNESDAY, "DINNER", curry);

        stock("Lentilles", 50, "g");

        var lentilles = line("Lentilles");
        org.assertj.core.api.Assertions.assertThat(lentilles.get("quantity").asDouble()).isEqualTo(200.0);
        org.assertj.core.api.Assertions.assertThat(lentilles.get("inStock").asDouble()).isEqualTo(50.0);
        org.assertj.core.api.Assertions.assertThat(lentilles.get("toBuy").asDouble()).isEqualTo(150.0);
    }

    @Test
    void somethingEntirelyInStockLeavesTheAislesAndIsStillShown() throws Exception {
        long curry = recipe("Curry", """
                {"name":"Lentilles","quantity":200,"unit":"g"}""");
        plan(WEDNESDAY, "DINNER", curry);
        stock("Lentilles", 500, "g");

        mvc.perform(get("/api/shopping?week=" + MONDAY).header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.aisles").isEmpty())
                .andExpect(jsonPath("$.remaining").value(0))
                // Shown rather than hidden, so nobody wonders where it went.
                .andExpect(jsonPath("$.covered.length()").value(1))
                .andExpect(jsonPath("$.covered[0].name").value("Lentilles"));
    }

    @Test
    void cookingAMealTakesItsIngredientsOutOfTheCupboard() throws Exception {
        long curry = recipe("Curry", """
                {"name":"Lentilles","quantity":200,"unit":"g"}""");
        long meal = plan(WEDNESDAY, "DINNER", curry);
        stock("Lentilles", 500, "g");

        mvc.perform(post("/api/plan/" + meal + "/cooked")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cooked").value(true));

        mvc.perform(get("/api/pantry").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$[0].quantity").value(300.0));

        // Saying it twice must not empty the shelf twice.
        mvc.perform(post("/api/plan/" + meal + "/cooked")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        mvc.perform(get("/api/pantry").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$[0].quantity").value(300.0));
    }

    @Test
    void aShelfThatRunsOutIsRemovedRatherThanKeptAtZero() throws Exception {
        long curry = recipe("Curry", """
                {"name":"Lentilles","quantity":200,"unit":"g"}""");
        long meal = plan(WEDNESDAY, "DINNER", curry);
        stock("Lentilles", 200, "g");

        mvc.perform(post("/api/plan/" + meal + "/cooked")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        mvc.perform(get("/api/pantry").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$").isEmpty());
    }

    // --- ticking, in a shop with no network ---------------------------------

    @Test
    void ticksMadeOfflineSyncBackAndTheLaterOneWins() throws Exception {
        long curry = recipe("Curry", """
                {"name":"Lentilles","quantity":200,"unit":"g"},
                {"name":"Tomate","quantity":300,"unit":"g"}""");
        plan(WEDNESDAY, "DINNER", curry);
        long lentilles = line("Lentilles").get("id").asLong();
        long tomate = line("Tomate").get("id").asLong();

        String now = java.time.Instant.now().toString();
        String earlier = java.time.Instant.now().minusSeconds(600).toString();

        mvc.perform(post("/api/shopping/sync?week=" + MONDAY)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"items":[{"id":%d,"checked":true,"at":"%s"},
                                          {"id":%d,"checked":true,"at":"%s"}]}"""
                                .formatted(lentilles, now, tomate, now)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.remaining").value(0));

        // A second phone comes back from the same shop with an older untick.
        // It must not undo what was already done.
        mvc.perform(post("/api/shopping/sync?week=" + MONDAY)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"items":[{"id":%d,"checked":false,"at":"%s"}]}"""
                                .formatted(lentilles, earlier)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.remaining").value(0));

        // A ticked line stays on the list, struck through rather than gone.
        org.assertj.core.api.Assertions.assertThat(line("Lentilles").get("checked").asBoolean())
                .isTrue();
    }

    @Test
    void aTickForALineThatNoLongerExistsIsSkippedRatherThanRefused() throws Exception {
        mvc.perform(post("/api/shopping/sync?week=" + MONDAY)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"items":[{"id":999999,"checked":true,"at":"2026-03-04T10:00:00Z"}]}"""))
                // A phone coming back from a basement is not told its whole
                // trip was invalid.
                .andExpect(status().isOk());
    }

    @Test
    void aTickedLineStaysOnTheListRatherThanDisappearing() throws Exception {
        long curry = recipe("Curry", """
                {"name":"Lentilles","quantity":200,"unit":"g"}""");
        plan(WEDNESDAY, "DINNER", curry);
        long lentilles = line("Lentilles").get("id").asLong();

        mvc.perform(put("/api/shopping/items/" + lentilles)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"checked":true}"""))
                .andExpect(jsonPath("$.aisles[0].items[0].checked").value(true))
                .andExpect(jsonPath("$.remaining").value(0));
    }

    // --- access -------------------------------------------------------------

    @Test
    void someoneElsesListIsReportedAsMissing() throws Exception {
        long curry = recipe("Curry", """
                {"name":"Lentilles","quantity":200,"unit":"g"}""");
        plan(WEDNESDAY, "DINNER", curry);
        long lentilles = line("Lentilles").get("id").asLong();

        String other = json.readTree(mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"autre-%d@fuelr.app","name":"Autre","password":"motdepasse123"}"""
                                .formatted(System.nanoTime())))
                .andReturn().getResponse().getContentAsString()).get("token").asText();

        mvc.perform(put("/api/shopping/items/" + lentilles)
                        .header("Authorization", "Bearer " + other)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"checked":true}"""))
                .andExpect(status().isNotFound());
    }

    @Test
    void theListIsNotPublic() throws Exception {
        mvc.perform(get("/api/shopping")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/pantry")).andExpect(status().isUnauthorized());
    }

    private void stock(String name, double quantity, String unit) throws Exception {
        mvc.perform(put("/api/pantry")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"%s","quantity":%s,"unit":"%s"}"""
                                .formatted(name, quantity, unit)))
                .andExpect(status().isOk());
    }
}
