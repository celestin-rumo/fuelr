package ch.celestin.fuelr.account;

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

import java.io.ByteArrayInputStream;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Everything Fuelr holds about one person, in one archive — and the two
 * things that make the archive safe to offer: it contains what is mine and
 * not the household's, and the link that fetches it works once.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class DataExportTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17");

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired DataExportService exports;
    @Autowired UserRepository users;

    private String token;
    private String email;

    @BeforeEach
    void signIn() throws Exception {
        email = "export-%d@fuelr.app".formatted(System.nanoTime());
        String response = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","name":"Chef","password":"motdepasse123"}""".formatted(email)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        token = json.readTree(response).get("token").asText();
    }

    private long recipe(String title) throws Exception {
        String created = mvc.perform(post("/api/recipes").header("Authorization", "Bearer " + token))
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

    /** Builds the archive in the foreground and fetches it through the public link. */
    private Map<String, byte[]> archive() throws Exception {
        Long userId = users.findByEmail(email).orElseThrow().getId();
        String link = exports.request(userId);
        exports.buildNow(userId, link, "fr");
        byte[] zip = mvc.perform(get("/api/account/export/" + link))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
        Map<String, byte[]> files = new LinkedHashMap<>();
        try (ZipInputStream in = new ZipInputStream(new ByteArrayInputStream(zip))) {
            ZipEntry entry;
            while ((entry = in.getNextEntry()) != null) {
                files.put(entry.getName(), in.readAllBytes());
            }
        }
        return files;
    }

    @Test
    void theArchiveHoldsEverythingThatIsMine() throws Exception {
        long id = recipe("Risotto");
        mvc.perform(post("/api/plan").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"date":"2026-03-04","slot":"DINNER","recipeId":%d,"servings":4}""".formatted(id)))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/weight").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"weighedOn":"2026-03-02","weightKg":62.4}"""))
                .andExpect(status().isOk());

        Map<String, byte[]> files = archive();
        assertThat(files.keySet()).contains("README.md", "recipes.json", "plan.json",
                "shopping.json", "journal.json", "profile.json");
        assertThat(new String(files.get("recipes.json"))).contains("Risotto");
        assertThat(new String(files.get("plan.json"))).contains("2026-03-04");
        assertThat(new String(files.get("profile.json"))).contains(email).contains("62.4");
        // Said out loud: what is deliberately not inside.
        assertThat(new String(files.get("README.md"))).contains("n'y est pas");
    }

    @Test
    void theLinkWorksOnceAndTheFileGoesWithIt() throws Exception {
        recipe("Risotto");
        Long userId = users.findByEmail(email).orElseThrow().getId();
        String link = exports.request(userId);
        exports.buildNow(userId, link, "fr");

        mvc.perform(get("/api/account/export/" + link)).andExpect(status().isOk());
        mvc.perform(get("/api/account/export/" + link)).andExpect(status().isGone());
    }

    @Test
    void aLinkNobodyMintedIsDead() throws Exception {
        mvc.perform(get("/api/account/export/" + OneTimeToken.mint())).andExpect(status().isGone());
    }

    @Test
    void askingForTheArchiveIsAcceptedAtOnce() throws Exception {
        mvc.perform(post("/api/account/export").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"locale":"fr"}"""))
                .andExpect(status().isAccepted());
    }

    @Test
    void deletingTheAccountNeedsThePasswordAndThenLeavesNothing() throws Exception {
        recipe("Risotto");

        mvc.perform(delete("/api/account").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"password":"pasdutout"}"""))
                .andExpect(status().isBadRequest());
        assertThat(users.findByEmail(email)).isPresent();

        mvc.perform(get("/api/account/deletion").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        mvc.perform(delete("/api/account").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"password":"motdepasse123"}"""))
                .andExpect(status().isNoContent());

        assertThat(users.findByEmail(email)).isEmpty();
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
        // The address is free again: registering with it works.
        mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","name":"Chef","password":"motdepasse123"}""".formatted(email)))
                .andExpect(status().isCreated());
    }
}
