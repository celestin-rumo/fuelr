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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Where a recipe came from, and why it is not a tag.
 *
 * The tags describe the dish and are ticked by hand in the editor. A marker
 * saying "a model wrote this" cannot be one of them: the day somebody can tick
 * it themselves it stops meaning anything, and the day they can untick it, it
 * stops being a record at all. So it is written by the code that creates the
 * row, the editor never sends it, and correcting an AI recipe from top to
 * bottom leaves it an AI recipe.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class RecipeOriginTest {

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
                                {"email":"origine-%d@fuelr.app","name":"Chef","password":"motdepasse123"}"""
                                .formatted(System.nanoTime())))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        token = json.readTree(response).get("token").asText();
    }

    private long typed(String title) throws Exception {
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

    private long fromIdea(String title) throws Exception {
        String created = mvc.perform(post("/api/recipes/from-idea")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"%s","minutes":25,
                                 "ingredients":[{"name":"Lentilles","quantity":300,"unit":"g"}],
                                 "steps":["Cuire 20 min."]}""".formatted(title)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(created).get("id").asLong();
    }

    @Test
    void aDishAModelInventedIsWrittenAsAnAiDraft() throws Exception {
        long id = fromIdea("Dahl de lentilles");

        mvc.perform(get("/api/recipes/" + id).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.origin").value("AI"))
                // A draft, like every import: nothing a model proposed is
                // written into the library as a finished recipe.
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.title").value("Dahl de lentilles"))
                // And every quantity it guessed arrives flagged.
                .andExpect(jsonPath("$.ingredients[0].needsReview").value(true));
    }

    @Test
    void aRecipeSomebodyTypedSaysSo() throws Exception {
        long id = typed("Risotto");

        mvc.perform(get("/api/recipes/" + id).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.origin").value("TYPED"));
    }

    @Test
    void correctingAnAiRecipeLeavesItAnAiRecipe() throws Exception {
        long id = fromIdea("Dahl de lentilles");

        // Everything about it rewritten, including the tags — which is exactly
        // the door a tag-based marker would have left open.
        mvc.perform(put("/api/recipes/" + id)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Mon dahl à moi","servings":6,
                                 "tags":["vegetarian","quick"],
                                 "ingredients":[{"name":"Lentilles","quantity":400,"unit":"g"}],
                                 "steps":["Ma façon de faire."]}"""))
                .andExpect(status().isOk());

        mvc.perform(get("/api/recipes/" + id).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Mon dahl à moi"))
                // A fact about where it came from, not about what it says now.
                .andExpect(jsonPath("$.origin").value("AI"));
    }

    @Test
    void theEditorCannotClaimAnOrigin() throws Exception {
        long id = typed("Risotto");

        mvc.perform(put("/api/recipes/" + id)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Risotto","servings":4,"origin":"AI",
                                 "ingredients":[{"name":"Riz","quantity":200,"unit":"g"}],
                                 "steps":["Cuire."]}"""))
                .andExpect(status().isOk());

        // Sent and ignored. A provenance somebody can assert is not one.
        mvc.perform(get("/api/recipes/" + id).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.origin").value("TYPED"));
    }

    @Test
    void theLibraryCanBeNarrowedToWhatAModelWrote() throws Exception {
        typed("Risotto");
        fromIdea("Dahl de lentilles");

        mvc.perform(get("/api/recipes").param("origins", "AI")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].title").value("Dahl de lentilles"))
                .andExpect(jsonPath("$[0].origin").value("AI"));

        mvc.perform(get("/api/recipes").param("origins", "TYPED")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].title").value("Risotto"));
    }

    @Test
    void anOriginNobodyRecognisesNarrowsNothingRatherThanFailing() throws Exception {
        typed("Risotto");

        // A stale bookmark should show a library, not a 400 — the same rule
        // the cuisines already follow.
        mvc.perform(get("/api/recipes").param("origins", "CARVED_IN_STONE")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void writingFromAnIdeaNeedsASession() throws Exception {
        mvc.perform(post("/api/recipes/from-idea")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Dahl"}"""))
                .andExpect(status().isUnauthorized());
    }
}
