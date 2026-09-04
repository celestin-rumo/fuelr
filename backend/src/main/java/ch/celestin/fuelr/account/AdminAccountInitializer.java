package ch.celestin.fuelr.account;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Who operates this installation, said in configuration.
 *
 * `ADMIN_EMAIL` names the operator's account, and this makes that true at
 * every boot rather than only at the first one. It used to create an account
 * and then never look again: whoever ran Fuelr had to sign in as an address
 * created for them, and pointing the flag at the address they actually use
 * did nothing at all. The answer to "make my account the admin" was a hand-run
 * `UPDATE` on the production database — which nobody can replay, nobody can
 * review, and which is forgotten the day the database is restored.
 *
 * Two things it will not do. It never *demotes*: taking the role away is a
 * decision with consequences and it must not be a side effect of changing an
 * environment variable — the last admin disappearing on a redeploy is exactly
 * how an installation locks its operator out. And it never touches a password:
 * an account that already exists keeps the one its owner set, so this cannot
 * be used to take an account over. `ADMIN_PASSWORD` is only ever used for an
 * account being created here.
 */
@Component
public class AdminAccountInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminAccountInitializer.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.admin.email}")
    private String adminEmail;

    @Value("${app.admin.password}")
    private String adminPassword;

    public AdminAccountInitializer(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(ApplicationArguments args) {
        Optional<User> named = userRepository.findByEmail(adminEmail);

        if (named.isPresent()) {
            User user = named.get();
            if (!"ADMIN".equals(user.getRole())) {
                // The account somebody registered themselves, promoted in
                // place: same password, same recipes, same everything.
                user.setRole("ADMIN");
                userRepository.save(user);
                log.info("Promoted {} to ADMIN", adminEmail);
            }
            return;
        }

        // Nobody holds that address. Create it, but only if this installation
        // has no operator at all — otherwise a typo in the variable would add
        // a second admin account nobody asked for.
        if (userRepository.existsByRole("ADMIN")) {
            log.warn("No account for {}, and an admin already exists; created nothing", adminEmail);
            return;
        }
        userRepository.save(new User(adminEmail, passwordEncoder.encode(adminPassword), "ADMIN"));
        log.info("Created the operator account {}", adminEmail);
    }
}
