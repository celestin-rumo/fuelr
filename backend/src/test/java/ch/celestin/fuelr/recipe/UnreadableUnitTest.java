package ch.celestin.fuelr.recipe;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
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
 * One row this app cannot measure must not take a screen down.
 *
 * It did. An import wrote `piece` where the app knows `pcs`, and from then on
 * `GET /api/recipes` answered 400 for that account — so the library reported
 * itself empty, with every recipe still in the database, and no amount of
 * reloading changed it. The unit is written into the row, so the damage
 * outlived the import that caused it.
 *
 * The unit is fixed at the door now, but that is only half: the door is not the
 * only way a row gets written, and a screen that renders nothing because one
 * line is unreadable is a screen that will break again. The row here is
 * inserted straight into the database on purpose — it is the state the fix has
 * to survive, not the path that produced it.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class UnreadableUnitTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17");

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;

    private String token;

    @BeforeEach
    void signIn() throws Exception {
        String response = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"unit-%d@fuelr.app","name":"Chef","password":"motdepasse123"}"""
                                .formatted(System.nanoTime())))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        token = json.readTree(response).get("token").asText();
    }

    private long recipeWithUnit(String unit) throws Exception {
        String created = mvc.perform(post("/api/recipes").header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(created).get("id").asLong();
        mvc.perform(put("/api/recipes/" + id)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Soupe de courge","servings":4,
                                 "ingredients":[{"name":"Courge","quantity":800,"unit":"g"}],
                                 "steps":["Cuire 30 min."]}"""))
                .andExpect(status().isOk());

        // Past the door, the way an import once did it.
        jdbc.update("UPDATE recipe_ingredients SET unit = ? WHERE recipe_id = ?", unit, id);
        return id;
    }

    @Test
    void theLibraryStillListsARecipeItCannotMeasure() throws Exception {
        recipeWithUnit("piece");

        mvc.perform(get("/api/recipes").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].title").value("Soupe de courge"))
                // No figures rather than no library: that is the state a card
                // with no ingredients is already drawn in.
                .andExpect(jsonPath("$[0].kcalPerServing").doesNotExist());
    }

    @Test
    void andSoDoesTheWeekItIsPlannedIn() throws Exception {
        long id = recipeWithUnit("piece");
        mvc.perform(post("/api/plan")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"date":"%s","slot":"DINNER","recipeId":%d,"servings":4}"""
                                .formatted(java.time.LocalDate.now(), id)))
                .andExpect(status().isCreated());

        mvc.perform(get("/api/plan").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void aLineWithNoUnitCostsNothingRatherThanEverything() throws Exception {
        // Every import produces these on purpose — "sel, poivre", "une poignée
        // de coriandre" — as a line it could not split. Refusing to compute a
        // recipe because one is in it would deny figures to most imported
        // recipes, which is a worse answer than figures that ignore a pinch.
        //
        // The API contract still demands a unit from a caller filling a form;
        // this is about what is already in the database, which is written by
        // an import rather than typed.
        String created = mvc.perform(post("/api/recipes").header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(created).get("id").asLong();
        mvc.perform(put("/api/recipes/" + id)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Soupe de courge","servings":4,
                                 "ingredients":[
                                   {"name":"Courge","quantity":800,"unit":"g"},
                                   {"name":"sel, poivre","quantity":1,"unit":"g"}],
                                 "steps":["Cuire 30 min."]}"""))
                .andExpect(status().isOk());
        jdbc.update("UPDATE recipe_ingredients SET unit = '' WHERE name = 'sel, poivre'");

        mvc.perform(get("/api/recipes").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                // The squash is measured; the pinch adds nothing and takes
                // nothing away — figures, rather than no figures at all.
                .andExpect(jsonPath("$[0].kcalPerServing").value(
                        org.hamcrest.Matchers.greaterThan(0.0)));
    }

    @Test
    void theEditorStillSaysWhatIsWrongWithIt() throws Exception {
        // The one place an exception is the right answer: somebody typed it,
        // and can fix it. Silence there would be a form that ignores its input.
        mvc.perform(post("/api/nutrition/compute")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"ingredients":[{"name":"Courge","quantity":2,"unit":"piece"}],
                                 "servings":4}"""))
                .andExpect(status().isBadRequest());
    }
}
