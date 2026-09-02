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

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class RecipeSeasonTest {

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
                                {"email":"saison-%d@fuelr.app","name":"Chef","password":"motdepasse123"}"""
                                .formatted(System.nanoTime())))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        token = json.readTree(response).get("token").asText();
    }

    private long recipe(String title, String seasons) throws Exception {
        String created = mvc.perform(post("/api/recipes").header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(created).get("id").asLong();
        mvc.perform(put("/api/recipes/" + id)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"%s","servings":4,"seasons":[%s],
                                 "ingredients":[{"name":"Courge","quantity":300,"unit":"g"}],
                                 "steps":["Cuire 20 min."]}""".formatted(title, seasons)))
                .andExpect(status().isOk());
        return id;
    }

    @Test
    void aRecipeCarriesNoneOneOrSeveralSeasons() throws Exception {
        long soup = recipe("Soupe de courge", "\"AUTUMN\",\"WINTER\"");
        long anytime = recipe("Pâtes au beurre", "");

        mvc.perform(get("/api/recipes/" + soup).header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.seasons.length()").value(2));
        // Most dishes are of no season, and that is a complete answer.
        mvc.perform(get("/api/recipes/" + anytime).header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.seasons").isEmpty());
    }

    @Test
    void anythingThatIsNotOneOfTheFourIsRefused() throws Exception {
        long id = recipe("Soupe", "\"AUTUMN\"");

        mvc.perform(put("/api/recipes/" + id)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Soupe","seasons":["MOUSSON"]}"""))
                .andExpect(status().isBadRequest());
    }

    @Test
    void filteringBySeasonAsksForEitherRatherThanBoth() throws Exception {
        recipe("Soupe de courge", "\"AUTUMN\",\"WINTER\"");
        recipe("Salade de tomates", "\"SUMMER\"");
        recipe("Pâtes au beurre", "");

        // Autumn or winter: the squash soup is both and appears once.
        String response = mvc.perform(get("/api/recipes?seasons=AUTUMN&seasons=WINTER")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andReturn().getResponse().getContentAsString();
        assertThat(json.readTree(response).get(0).get("title").asText())
                .isEqualTo("Soupe de courge");

        mvc.perform(get("/api/recipes?seasons=SUMMER").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].title").value("Salade de tomates"));
    }

    @Test
    void seasonNarrowsAlongsideTheOtherFiltersRatherThanReplacingThem() throws Exception {
        recipe("Soupe de courge", "\"AUTUMN\"");
        recipe("Gratin de courge", "\"AUTUMN\"");

        mvc.perform(get("/api/recipes?seasons=AUTUMN&q=soupe")
                        .header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].title").value("Soupe de courge"));
    }

    @Test
    void withNoSeasonAskedForNothingIsFilteredOut() throws Exception {
        recipe("Soupe de courge", "\"AUTUMN\"");
        recipe("Pâtes au beurre", "");

        mvc.perform(get("/api/recipes").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    void aDuplicateKeepsTheSeasonsOfTheOriginal() throws Exception {
        long soup = recipe("Soupe de courge", "\"AUTUMN\",\"WINTER\"");

        mvc.perform(post("/api/recipes/" + soup + "/duplicate")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.seasons.length()").value(2));
    }

    @Test
    void theSeasonOfADateIsTheNorthernOne() {
        assertThat(Season.of(LocalDate.of(2026, 4, 15))).isEqualTo(Season.SPRING);
        assertThat(Season.of(LocalDate.of(2026, 7, 15))).isEqualTo(Season.SUMMER);
        assertThat(Season.of(LocalDate.of(2026, 10, 15))).isEqualTo(Season.AUTUMN);
        assertThat(Season.of(LocalDate.of(2026, 1, 15))).isEqualTo(Season.WINTER);
        // The boundaries, which are the part that gets written wrong.
        assertThat(Season.of(LocalDate.of(2026, 3, 1))).isEqualTo(Season.SPRING);
        assertThat(Season.of(LocalDate.of(2026, 2, 28))).isEqualTo(Season.WINTER);
        assertThat(Season.of(LocalDate.of(2026, 12, 1))).isEqualTo(Season.WINTER);
    }

    @Test
    void theCardCarriesTheSeasonsSoTheGridNeedsNoSecondCall() throws Exception {
        recipe("Soupe de courge", "\"AUTUMN\",\"WINTER\"");

        mvc.perform(get("/api/recipes").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$[0].seasons.length()").value(2));
    }
}
