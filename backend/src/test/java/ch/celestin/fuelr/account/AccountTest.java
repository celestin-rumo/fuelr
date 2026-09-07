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

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * What somebody may change about their own account.
 *
 * Three of these tests are about what does *not* happen: an address is not
 * moved before its link is clicked, a taken address is not confessed, and a
 * password change does not leave the previous one's sessions open.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class AccountTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17");

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired EmailChangeTokenRepository tokens;

    private String email;
    private String token;

    @BeforeEach
    void signIn() throws Exception {
        email = "compte-%d@fuelr.app".formatted(System.nanoTime());
        token = register(email);
    }

    private String register(String address) throws Exception {
        String response = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","name":"Chef","password":"motdepasse123","locale":"fr"}"""
                                .formatted(address)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("token").asText();
    }

    /** Mints a change link the way the service does, since the real one is only emailed. */
    private String changeLinkFor(String address, String newEmail) {
        String raw = OneTimeToken.mint();
        tokens.save(new EmailChangeToken(
                users.findByEmail(address).orElseThrow().getId(), newEmail,
                OneTimeToken.hash(raw), Instant.now().plus(AccountService.EMAIL_CHANGE_LIFETIME)));
        return raw;
    }

    @Test
    void nameAndLanguageAreTheAccountsOwn() throws Exception {
        mvc.perform(put("/api/account")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Céline","locale":"de"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Céline"))
                .andExpect(jsonPath("$.locale").value("de"));

        // And it follows the account, not the request that set it.
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.locale").value("de"));
    }

    @Test
    void aLanguageNobodyHasIsDroppedRatherThanStored() throws Exception {
        mvc.perform(put("/api/account")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"locale":"klingon"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.locale").doesNotExist());
    }

    @Test
    void changingThePasswordClosesTheOtherDevicesAndKeepsThisOne() throws Exception {
        String phone = mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"motdepasse123"}""".formatted(email)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String phoneToken = json.readTree(phone).get("token").asText();

        mvc.perform(put("/api/account/password")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"current":"motdepasse123","next":"nouveaumotdepasse"}"""))
                .andExpect(status().isNoContent());

        // The phone's session is gone; the one that made the change stays.
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + phoneToken))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        // And the new password is the one that works.
        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"nouveaumotdepasse"}""".formatted(email)))
                .andExpect(status().isOk());
    }

    @Test
    void theWrongCurrentPasswordChangesNothing() throws Exception {
        mvc.perform(put("/api/account/password")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"current":"pasdutout","next":"nouveaumotdepasse"}"""))
                .andExpect(status().isBadRequest());

        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"motdepasse123"}""".formatted(email)))
                .andExpect(status().isOk());
    }

    @Test
    void anAddressMovesOnlyWhenItsLinkIsClicked() throws Exception {
        String next = "nouvelle-%d@fuelr.app".formatted(System.nanoTime());

        mvc.perform(post("/api/account/email")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"motdepasse123"}""".formatted(next)))
                .andExpect(status().isAccepted());

        // Asked for, not done: the login is still the old address.
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.email").value(email));

        String link = changeLinkFor(email, next);
        mvc.perform(post("/api/auth/verify-email-change")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"token":"%s"}""".formatted(link)))
                .andExpect(status().isNoContent());

        // Now it is, and the new address arrives verified: the click was the proof.
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.email").value(next))
                .andExpect(jsonPath("$.emailVerified").value(true));

        // A used link is dead.
        mvc.perform(post("/api/auth/verify-email-change")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"token":"%s"}""".formatted(link)))
                .andExpect(status().isGone());
    }

    @Test
    void aTakenAddressIsNeverConfessed() throws Exception {
        String other = "autre-%d@fuelr.app".formatted(System.nanoTime());
        register(other);

        // The same 202 as for a free address. What differs is in the mail.
        mvc.perform(post("/api/account/email")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"motdepasse123"}""".formatted(other)))
                .andExpect(status().isAccepted());

        assertThat(tokens.findAll().stream()
                .anyMatch(one -> one.getNewEmail().equals(other))).isFalse();
    }

    @Test
    void aLinkForAnAddressTakenSinceIsDead() throws Exception {
        String next = "convoitee-%d@fuelr.app".formatted(System.nanoTime());
        String link = changeLinkFor(email, next);
        register(next);

        mvc.perform(post("/api/auth/verify-email-change")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"token":"%s"}""".formatted(link)))
                .andExpect(status().isGone());
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.email").value(email));
    }

    @Test
    void theAccountNeedsASession() throws Exception {
        mvc.perform(put("/api/account").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }
}
