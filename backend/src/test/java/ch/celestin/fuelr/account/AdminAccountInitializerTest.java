package ch.celestin.fuelr.account;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Who operates this installation is said in configuration.
 *
 * The point of these is what does *not* happen. Naming an address must be
 * able to promote the account somebody already registered — otherwise the
 * only answer to "make my account the operator" is a hand-run `UPDATE` on the
 * production database, which nobody can replay and which a restore forgets.
 * But it must not take a password over, must not add a second admin on a
 * typo, and must never demote: the last operator vanishing on a redeploy is
 * how an installation locks its owner out.
 */
@SpringBootTest
@Testcontainers
class AdminAccountInitializerTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17");

    @Autowired UserRepository users;
    @Autowired PasswordEncoder encoder;
    @Autowired AdminAccountInitializer initializer;

    private AdminAccountInitializer pointedAt(String email) {
        AdminAccountInitializer one = new AdminAccountInitializer(users, encoder);
        org.springframework.test.util.ReflectionTestUtils.setField(one, "adminEmail", email);
        org.springframework.test.util.ReflectionTestUtils.setField(one, "adminPassword", "changeme");
        return one;
    }

    private String fresh(String prefix) {
        return prefix + "-" + System.nanoTime() + "@fuelr.test";
    }

    @Test
    void promotesTheAccountSomebodyAlreadyRegistered() {
        // The whole reason this exists: the operator signs in with the address
        // they use, not one created for them.
        String email = fresh("cook");
        String hash = encoder.encode("motdepasse123");
        users.save(new User(email, hash, "USER"));

        pointedAt(email).run(null);

        User promoted = users.findByEmail(email).orElseThrow();
        assertThat(promoted.getRole()).isEqualTo("ADMIN");
        // Same account, not a new one: the password is untouched, so this
        // cannot be used to take somebody's account over.
        assertThat(promoted.getPasswordHash()).isEqualTo(hash);
    }

    @Test
    void leavesAnAdminAlone() {
        String email = fresh("already");
        users.save(new User(email, encoder.encode("motdepasse123"), "ADMIN"));

        pointedAt(email).run(null);

        assertThat(users.findByEmail(email).orElseThrow().getRole()).isEqualTo("ADMIN");
    }

    @Test
    void neverDemotesTheOperatorItIsNoLongerPointedAt() {
        // Changing the variable must not lock the installation's owner out.
        String kept = fresh("kept");
        users.save(new User(kept, encoder.encode("motdepasse123"), "ADMIN"));

        pointedAt(fresh("someone-else")).run(null);

        assertThat(users.findByEmail(kept).orElseThrow().getRole()).isEqualTo("ADMIN");
    }

    @Test
    void createsNothingForAnAddressNobodyHoldsWhenAnAdminExists() {
        // A typo in the variable would otherwise add a second admin account
        // nobody asked for, with a password from an environment file.
        String typo = fresh("typo");
        assertThat(users.existsByRole("ADMIN")).isTrue();

        pointedAt(typo).run(null);

        assertThat(users.findByEmail(typo)).isEmpty();
    }
}
