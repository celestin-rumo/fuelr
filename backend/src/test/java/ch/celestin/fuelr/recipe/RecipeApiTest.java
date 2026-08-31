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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class RecipeApiTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17");

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private String token;

    @BeforeEach
    void signIn() throws Exception {
        String email = "chef-" + System.nanoTime() + "@fuelr.app";
        String response = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","name":"Chef","password":"motdepasse123"}"""
                                .formatted(email)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        token = json.readTree(response).get("token").asText();
    }

    private long createDraft() throws Exception {
        String response = mvc.perform(post("/api/recipes").header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("id").asLong();
    }

    @Test
    void createsADraftWithNothingFilledIn() throws Exception {
        mvc.perform(post("/api/recipes").header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.title").doesNotExist())
                .andExpect(jsonPath("$.ingredients").isEmpty())
                .andExpect(jsonPath("$.steps").isEmpty());
    }

    @Test
    void savesAHalfFinishedDraftWithoutComplaining() throws Exception {
        long id = createDraft();

        // A title and nothing else: exactly what the editor sends after the
        // first keystroke. It must be stored, not rejected.
        mvc.perform(put("/api/recipes/" + id)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Curry de lentilles"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Curry de lentilles"))
                .andExpect(jsonPath("$.status").value("DRAFT"));
    }

    @Test
    void keepsTheAuthorsOrderOfIngredientsAndSteps() throws Exception {
        long id = createDraft();

        mvc.perform(put("/api/recipes/" + id)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Curry","servings":4,
                                 "ingredients":[
                                   {"name":"Lentilles corail","quantity":300,"unit":"g"},
                                   {"name":"Lait de coco","quantity":400,"unit":"ml"},
                                   {"name":"Oignon","quantity":1,"unit":"pcs"}],
                                 "steps":["Émincer l'oignon.","Ajouter le curry.","Cuire 15 min."],
                                 "tags":["Végétarien"]}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ingredients[0].name").value("Lentilles corail"))
                .andExpect(jsonPath("$.ingredients[2].name").value("Oignon"))
                .andExpect(jsonPath("$.steps[0]").value("Émincer l'oignon."))
                .andExpect(jsonPath("$.steps[2]").value("Cuire 15 min."))
                .andExpect(jsonPath("$.tags[0]").value("Végétarien"));
    }

    @Test
    void refusesToPublishWithoutAnIngredient() throws Exception {
        long id = createDraft();
        mvc.perform(put("/api/recipes/" + id)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"title":"Curry","steps":["Cuire."]}"""));

        mvc.perform(post("/api/recipes/" + id + "/publish")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$[0].field").value("ingredients"))
                .andExpect(jsonPath("$[0].message").value("no_ingredient"));
    }

    @Test
    void refusesToPublishWithoutAStep() throws Exception {
        long id = createDraft();
        mvc.perform(put("/api/recipes/" + id)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"title":"Curry","ingredients":[{"name":"riz","quantity":200,"unit":"g"}]}"""));

        mvc.perform(post("/api/recipes/" + id + "/publish")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$[0].field").value("steps"))
                .andExpect(jsonPath("$[0].message").value("no_step"));
    }

    @Test
    void refusesToPublishWithABlankStep() throws Exception {
        long id = createDraft();
        mvc.perform(put("/api/recipes/" + id)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"title":"Curry","ingredients":[{"name":"riz","quantity":200,"unit":"g"}],
                         "steps":["Cuire.","   "]}"""));

        mvc.perform(post("/api/recipes/" + id + "/publish")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$[0].message").value("empty_step"));
    }

    @Test
    void publishesACompleteRecipe() throws Exception {
        long id = createDraft();
        mvc.perform(put("/api/recipes/" + id)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"title":"Curry de lentilles","servings":4,
                         "ingredients":[{"name":"Lentilles corail","quantity":300,"unit":"g"}],
                         "steps":["Cuire 15 min à couvert."]}"""));

        mvc.perform(post("/api/recipes/" + id + "/publish")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PUBLISHED"));
    }

    @Test
    void hidesRecipesBelongingToSomeoneElse() throws Exception {
        long id = createDraft();

        // A second account must not see the first one's draft, and must be told
        // it does not exist rather than that it is forbidden.
        String other = json.readTree(mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"other-%d@fuelr.app","name":"Other","password":"motdepasse123"}"""
                                .formatted(System.nanoTime())))
                .andReturn().getResponse().getContentAsString()).get("token").asText();

        mvc.perform(get("/api/recipes/" + id).header("Authorization", "Bearer " + other))
                .andExpect(status().isNotFound());

        String list = mvc.perform(get("/api/recipes").header("Authorization", "Bearer " + other))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(list).isEqualTo("[]");
    }

    @Test
    void requiresATokenThroughout() throws Exception {
        mvc.perform(post("/api/recipes")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/recipes")).andExpect(status().isUnauthorized());
    }
}
