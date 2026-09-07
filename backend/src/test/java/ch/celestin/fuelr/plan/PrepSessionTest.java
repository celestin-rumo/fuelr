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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * A week already on the plan, read as one afternoon's work.
 *
 * The opposite end from `BatchSuggestionTest`: nothing is chosen here, a week
 * that already exists is organised. Same rule about what a base is, because
 * there must not be two — a set proposed on one arithmetic and prepared on
 * another would disagree with itself.
 */
@SpringBootTest(properties = "app.subscription.enforce=false")
@AutoConfigureMockMvc
@Testcontainers
class PrepSessionTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17");

    private static final String MONDAY = "2026-03-02";
    private static final String TUESDAY = "2026-03-03";
    private static final String WEDNESDAY = "2026-03-04";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String token;

    @BeforeEach
    void signIn() throws Exception {
        String response = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"prep-%d@fuelr.app","name":"Chef","password":"motdepasse123"}"""
                                .formatted(System.nanoTime())))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        token = json.readTree(response).get("token").asText();
    }

    private long recipe(String title, int minutes, String ingredients) throws Exception {
        String created = mvc.perform(post("/api/recipes").header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(created).get("id").asLong();
        mvc.perform(put("/api/recipes/" + id)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"%s","servings":4,"totalMinutes":%d,
                                 "ingredients":[%s],"steps":["Cuire."]}"""
                                .formatted(title, minutes, ingredients)))
                .andExpect(status().isOk());
        return id;
    }

    private long plan(String date, long recipeId) throws Exception {
        String response = mvc.perform(post("/api/plan")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"date":"%s","slot":"DINNER","recipeId":%d,"servings":4}"""
                                .formatted(date, recipeId)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("id").asLong();
    }

    private org.springframework.test.web.servlet.ResultActions session() throws Exception {
        return mvc.perform(get("/api/plan/prep").param("week", MONDAY)
                .header("Authorization", "Bearer " + token));
    }

    @Test
    void theWorkIsGroupedByWhatIsPreparedOnceForSeveralDishes() throws Exception {
        plan(MONDAY, recipe("Dahl", 30, """
                {"name":"Lentilles","quantity":300,"unit":"g"},
                {"name":"Curry","quantity":1,"unit":"c.à.s"}"""));
        plan(TUESDAY, recipe("Soupe", 25, """
                {"name":"Lentilles","quantity":200,"unit":"g"},
                {"name":"Poireaux","quantity":300,"unit":"g"}"""));

        session()
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weekStart").value(MONDAY))
                // Once for both, and the total is what to actually cook.
                .andExpect(jsonPath("$.bases.length()").value(1))
                .andExpect(jsonPath("$.bases[0].name").value("Lentilles"))
                .andExpect(jsonPath("$.bases[0].quantity").value(500.0))
                .andExpect(jsonPath("$.bases[0].dishes.length()").value(2))
                // Longest first: what takes the longest starts.
                .andExpect(jsonPath("$.dishes[0].title").value("Dahl"))
                .andExpect(jsonPath("$.dishes[1].title").value("Soupe"))
                // And what is already made is not asked for a second time.
                .andExpect(jsonPath("$.dishes[0].rest[0].name").value("Curry"))
                .andExpect(jsonPath("$.dishes[0].rest.length()").value(1));
    }

    @Test
    void anOnionInEveryDishIsNotSharedWork() throws Exception {
        plan(MONDAY, recipe("Plat A", 30, """
                {"name":"Oignon","quantity":1,"unit":"pcs"},
                {"name":"Poulet","quantity":300,"unit":"g"}"""));
        plan(TUESDAY, recipe("Plat B", 25, """
                {"name":"Oignon","quantity":1,"unit":"pcs"},
                {"name":"Cabillaud","quantity":300,"unit":"g"}"""));

        // Peeling one onion twice is not an afternoon saved, and a sheet that
        // says it is looks rigorous while being useless.
        session()
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bases.length()").value(0))
                .andExpect(jsonPath("$.dishes.length()").value(2));
    }

    @Test
    void quantitiesFollowTheServingsEachMealWasPlannedFor() throws Exception {
        long dahl = recipe("Dahl", 30, """
                {"name":"Lentilles","quantity":200,"unit":"g"}""");
        long mealId = plan(MONDAY, dahl);
        plan(TUESDAY, dahl);

        // Eight for Monday, four for Tuesday: 400 + 200.
        mvc.perform(put("/api/plan/" + mealId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"servings":8}"""))
                .andExpect(status().isOk());

        session()
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bases[0].quantity").value(600.0));
    }

    @Test
    void aMealTakenOutOfTheShoppingIsStillCooked() throws Exception {
        long dahl = recipe("Dahl", 30, """
                {"name":"Lentilles","quantity":300,"unit":"g"}""");
        long mealId = plan(MONDAY, dahl);
        plan(TUESDAY, recipe("Soupe", 25, """
                {"name":"Lentilles","quantity":200,"unit":"g"}"""));

        mvc.perform(put("/api/plan/" + mealId)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"inShopping":false}"""))
                .andExpect(status().isOk());

        // Having the lentils already does not remove the work of cooking them.
        session()
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dishes.length()").value(2))
                .andExpect(jsonPath("$.bases.length()").value(1))
                .andExpect(jsonPath("$.bases[0].quantity").value(500.0));
    }

    @Test
    void anEmptyWeekIsAnEmptySessionRatherThanAFailure() throws Exception {
        session()
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bases.length()").value(0))
                .andExpect(jsonPath("$.dishes.length()").value(0));
    }

    @Test
    void theSameIngredientTwiceInOneRecipeIsStillOneDish() throws Exception {
        plan(MONDAY, recipe("Plat A", 30, """
                {"name":"Riz","quantity":200,"unit":"g"},
                {"name":"riz","quantity":200,"unit":"g"}"""));
        plan(WEDNESDAY, recipe("Plat B", 25, """
                {"name":"Riz","quantity":300,"unit":"g"}"""));

        // Two dishes, not three: a recipe listing rice twice still cooks it
        // once, and counting it twice would inflate the whole sheet.
        session()
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bases[0].dishes.length()").value(2));
    }

    @Test
    void aSachetInEveryDishIsNotSharedWork() throws Exception {
        // A packet of baking powder in both cakes is bought twice and opened
        // twice; nothing about it is prepared once. Same rule as the onion.
        plan(MONDAY, recipe("Gâteau A", 30, """
                {"name":"Levure","quantity":1,"unit":"sachet"},
                {"name":"Farine","quantity":300,"unit":"g"}"""));
        plan(TUESDAY, recipe("Gâteau B", 25, """
                {"name":"Levure","quantity":1,"unit":"sachet"},
                {"name":"Semoule","quantity":300,"unit":"g"}"""));

        session()
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bases.length()").value(0))
                .andExpect(jsonPath("$.dishes.length()").value(2));
    }

    @Test
    void theSessionNeedsASession() throws Exception {
        mvc.perform(get("/api/plan/prep")).andExpect(status().isUnauthorized());
    }
}
