package ch.celestin.fuelr.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import jakarta.servlet.http.Cookie;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The point of these tests is the ticket's first acceptance criterion: the same
 * token authenticates a browser (cookie) and a non-browser client (header).
 */
@SpringBootTest
@AutoConfigureMockMvc(print = org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint.NONE)
@Testcontainers
class AuthApiTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17");

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper json;

    private String register(String email) throws Exception {
        String body = """
                {"email":"%s","name":"Camille","password":"motdepasse123"}""".formatted(email);
        String response = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(cookie().exists("fuelr_token"))
                .andExpect(cookie().httpOnly("fuelr_token", true))
                .andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("token").asText();
    }

    @Test
    void registersAndReturnsATokenInTheBody() throws Exception {
        String token = register("camille@fuelr.app");

        assertThat(token).isNotBlank();
        // Three dot-separated segments: a real JWT a native client can carry.
        assertThat(token.split("\\.")).hasSize(3);
    }

    @Test
    void authenticatesANonBrowserClientFromTheAuthorizationHeader() throws Exception {
        String token = register("header@fuelr.app");

        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("header@fuelr.app"))
                .andExpect(jsonPath("$.role").value("USER"));
    }

    @Test
    void authenticatesABrowserFromTheHttpOnlyCookie() throws Exception {
        String token = register("cookie@fuelr.app");

        mvc.perform(get("/api/auth/me").cookie(new Cookie("fuelr_token", token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("cookie@fuelr.app"));
    }

    @Test
    void rejectsAnAnonymousCall() throws Exception {
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsAForgedToken() throws Exception {
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer not.a.token"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void logsInAnExistingAccount() throws Exception {
        register("login@fuelr.app");

        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"login@fuelr.app","password":"motdepasse123"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty());
    }

    @Test
    void refusesAWrongPasswordWithoutSayingWhichHalfIsWrong() throws Exception {
        register("wrong@fuelr.app");

        String unknown = mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"nobody@fuelr.app","password":"motdepasse123"}"""))
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse().getErrorMessage();

        String badPassword = mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"wrong@fuelr.app","password":"paslebonmotdepasse"}"""))
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse().getErrorMessage();

        // Identical answers, so the endpoint never reveals which emails exist.
        assertThat(unknown).isEqualTo(badPassword);
    }

    @Test
    void refusesAnAlreadyRegisteredEmail() throws Exception {
        register("dup@fuelr.app");

        mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"dup@fuelr.app","name":"Autre","password":"motdepasse123"}"""))
                .andExpect(status().isConflict());
    }

    @Test
    void refusesAShortPassword() throws Exception {
        mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"court@fuelr.app","name":"Camille","password":"court"}"""))
                .andExpect(status().isBadRequest());
    }

    @Test
    void guardsTheNutritionEndpointBehindTheSameToken() throws Exception {
        String payload = """
                {"servings":2,"ingredients":[{"name":"riz","quantity":200,"unit":"g"}]}""";

        mvc.perform(post("/api/nutrition/compute")
                        .contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isUnauthorized());

        String token = register("nutrition@fuelr.app");
        String response = mvc.perform(post("/api/nutrition/compute")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content(payload))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        JsonNode body = json.readTree(response);
        assertThat(body.get("perServing").get("kcal").asDouble()).isEqualTo(350.0);
    }

    /**
     * MockMvc does not replay the servlet ERROR dispatch by default, which is
     * how a real container turns a thrown ResponseStatusException into a
     * second request to /error. That gap once hid a bug where every failure on
     * a public endpoint came back as 401. Replaying the dispatch here keeps it
     * honest.
     */
    @Test
    void reportsTheRealStatusOfAFailureOnAPublicEndpoint() throws Exception {
        register("dispatch@fuelr.app");

        mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"dispatch@fuelr.app","name":"Autre","password":"motdepasse123"}"""))
                .andExpect(status().isConflict());

        mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"court@fuelr.app","name":"C","password":"court"}"""))
                .andExpect(status().isBadRequest());
    }

    @Test
    void keepsTheHealthEndpointPublic() throws Exception {
        mvc.perform(get("/api/health")).andExpect(status().isOk());
    }
}
