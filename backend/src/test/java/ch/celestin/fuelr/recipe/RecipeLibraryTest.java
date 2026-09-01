package ch.celestin.fuelr.recipe;

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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Finding, ordering, copying, deleting and exporting a recipe library. */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class RecipeLibraryTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17");

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String token;

    @BeforeEach
    void signIn() throws Exception {
        String email = "lib-" + System.nanoTime() + "@fuelr.app";
        String response = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","name":"Chef","password":"motdepasse123"}"""
                                .formatted(email)))
                .andReturn().getResponse().getContentAsString();
        token = json.readTree(response).get("token").asText();
    }

    private long seed(String title, String ingredient, String... tags) throws Exception {
        String created = mvc.perform(post("/api/recipes").header("Authorization", "Bearer " + token))
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(created).get("id").asLong();
        String tagJson = tags.length == 0 ? "[]"
                : "[\"" + String.join("\",\"", tags) + "\"]";
        mvc.perform(put("/api/recipes/" + id)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"title":"%s","servings":4,
                         "ingredients":[{"name":"%s","quantity":100,"unit":"g"}],
                         "steps":["Cuire 10 min."],"tags":%s}"""
                        .formatted(title, ingredient, tagJson)));
        return id;
    }

    private void pin(long id) throws Exception {
        mvc.perform(put("/api/recipes/" + id + "/favorite")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"favorite\":true}"));
    }

    // --- search -----------------------------------------------------------

    @Test
    void searchesOnTheTitle() throws Exception {
        seed("Curry de lentilles", "Lentilles");
        seed("Saumon grillé", "Saumon");

        mvc.perform(get("/api/recipes").param("q", "curry")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].title").value("Curry de lentilles"));
    }

    @Test
    void searchesOnIngredientNamesToo() throws Exception {
        seed("Plat du soir", "Lentilles corail");
        seed("Autre plat", "Saumon");

        // The word appears nowhere in the title — only in an ingredient.
        mvc.perform(get("/api/recipes").param("q", "lentilles")
                        .header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].title").value("Plat du soir"));
    }

    @Test
    void ignoresCaseAndAccentlessTyping() throws Exception {
        seed("Saumon Grillé", "Saumon");

        mvc.perform(get("/api/recipes").param("q", "SAUMON")
                        .header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void filtersOnASingleTag() throws Exception {
        seed("Végé", "Tofu", "vegetarian");
        seed("Rapide", "Riz", "quick");

        mvc.perform(get("/api/recipes").param("tags", "vegetarian")
                        .header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].title").value("Végé"));
    }

    @Test
    void stacksTagsRatherThanWideningTheResults() throws Exception {
        seed("Les deux", "Tofu", "vegetarian", "quick");
        seed("Un seul", "Riz", "vegetarian");

        // Cumulative: a recipe must carry every selected tag.
        mvc.perform(get("/api/recipes")
                        .param("tags", "vegetarian").param("tags", "quick")
                        .header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].title").value("Les deux"));
    }

    @Test
    void combinesTheTermAndTheTags() throws Exception {
        seed("Curry végé", "Tofu", "vegetarian");
        seed("Curry carné", "Boeuf");

        mvc.perform(get("/api/recipes")
                        .param("q", "curry").param("tags", "vegetarian")
                        .header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].title").value("Curry végé"));
    }

    // --- manual favourite order -------------------------------------------

    @Test
    void ordersFavouritesByHandAndKeepsIt() throws Exception {
        long first = seed("Alpha", "Riz");
        long second = seed("Beta", "Riz");
        pin(first);
        pin(second);

        // Pinned in order, so Alpha leads.
        mvc.perform(get("/api/recipes").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$[0].title").value("Alpha"));

        mvc.perform(put("/api/recipes/" + second + "/favorite/move")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"direction\":-1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("Beta"));

        // And it survives a fresh read rather than living in the response only.
        mvc.perform(get("/api/recipes").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$[0].title").value("Beta"))
                .andExpect(jsonPath("$[1].title").value("Alpha"));
    }

    @Test
    void leavesUnpinnedRecipesOnTheirOwnOrdering() throws Exception {
        long pinned = seed("Épinglée", "Riz");
        seed("Récente", "Riz");
        pin(pinned);

        // The pinned one leads even though the other was touched later.
        mvc.perform(get("/api/recipes").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$[0].title").value("Épinglée"))
                .andExpect(jsonPath("$[1].title").value("Récente"));
    }

    @Test
    void refusesToOrderARecipeThatIsNotPinned() throws Exception {
        long id = seed("Ordinaire", "Riz");

        mvc.perform(put("/api/recipes/" + id + "/favorite/move")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"direction\":-1}"))
                .andExpect(status().isConflict());
    }

    @Test
    void unpinningAndRepinningDoesNotDisturbTheOthers() throws Exception {
        long a = seed("A", "Riz");
        long b = seed("B", "Riz");
        long c = seed("C", "Riz");
        pin(a); pin(b); pin(c);

        // Unpin the middle one, then pin it again: it goes to the end, and A
        // and C keep their relative order.
        mvc.perform(put("/api/recipes/" + b + "/favorite")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"favorite\":false}"));
        pin(b);

        mvc.perform(get("/api/recipes").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$[0].title").value("A"))
                .andExpect(jsonPath("$[1].title").value("C"))
                .andExpect(jsonPath("$[2].title").value("B"));
    }

    // --- duplicate --------------------------------------------------------

    @Test
    void duplicatesEverythingAndKeepsTheCopyIndependent() throws Exception {
        long id = seed("Curry", "Lentilles", "vegetarian");
        mvc.perform(post("/api/recipes/" + id + "/publish")
                .header("Authorization", "Bearer " + token));

        String copy = mvc.perform(post("/api/recipes/" + id + "/duplicate")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Curry (copie)"))
                .andExpect(jsonPath("$.ingredients[0].name").value("Lentilles"))
                .andExpect(jsonPath("$.steps[0]").value("Cuire 10 min."))
                .andExpect(jsonPath("$.tags[0]").value("vegetarian"))
                // A copy has not been reviewed, so it starts as a draft.
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andReturn().getResponse().getContentAsString();
        long copyId = json.readTree(copy).get("id").asLong();

        mvc.perform(put("/api/recipes/" + copyId)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Variante\"}"));

        // Editing the copy must not touch the original.
        mvc.perform(get("/api/recipes/" + id).header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.title").value("Curry"));
    }

    // --- delete -----------------------------------------------------------

    @Test
    void deletesARecipeAndClosesTheFavouriteGap() throws Exception {
        long a = seed("A", "Riz");
        long b = seed("B", "Riz");
        long c = seed("C", "Riz");
        pin(a); pin(b); pin(c);

        mvc.perform(delete("/api/recipes/" + b).header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/recipes").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].title").value("A"))
                .andExpect(jsonPath("$[1].title").value("C"));
    }

    @Test
    void refusesToDeleteSomeoneElsesRecipe() throws Exception {
        long id = seed("Privée", "Riz");
        String other = json.readTree(mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"x-%d@fuelr.app","name":"X","password":"motdepasse123"}"""
                                .formatted(System.nanoTime())))
                .andReturn().getResponse().getContentAsString()).get("token").asText();

        mvc.perform(delete("/api/recipes/" + id).header("Authorization", "Bearer " + other))
                .andExpect(status().isNotFound());
    }

    // --- export -----------------------------------------------------------

    @Test
    void exportsEveryRecipeWhole() throws Exception {
        seed("Curry", "Lentilles", "vegetarian");
        seed("Saumon", "Saumon");

        mvc.perform(get("/api/recipes/export").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition",
                        "attachment; filename=\"fuelr-recettes.json\""))
                .andExpect(jsonPath("$.length()").value(2))
                // Whole means ingredients and steps too, not just the titles.
                .andExpect(jsonPath("$[?(@.title=='Curry')].ingredients[0].name")
                        .value("Lentilles"))
                .andExpect(jsonPath("$[?(@.title=='Curry')].steps[0]")
                        .value("Cuire 10 min."));
    }

    @Test
    void exportIsScopedToTheCaller() throws Exception {
        seed("À moi", "Riz");
        String other = json.readTree(mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"y-%d@fuelr.app","name":"Y","password":"motdepasse123"}"""
                                .formatted(System.nanoTime())))
                .andReturn().getResponse().getContentAsString()).get("token").asText();

        mvc.perform(get("/api/recipes/export").header("Authorization", "Bearer " + other))
                .andExpect(jsonPath("$.length()").value(0));
    }
}
