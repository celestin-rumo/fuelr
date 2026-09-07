package ch.celestin.fuelr.account;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    boolean existsByRole(String role);

    java.util.Optional<User> findByReferralCode(String code);

    java.util.Optional<User> findByReminderToken(String token);

    long countByReferredBy(Long userId);

    java.util.List<User> findByReminderDayAndReminderHour(Short day, Short hour);
}
