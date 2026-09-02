package ch.celestin.fuelr.log;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface MealLogRepository extends JpaRepository<MealLogEntry, Long> {

    List<MealLogEntry> findByUserIdAndDateBetweenOrderByDateAscIdAsc(
            Long userId, LocalDate from, LocalDate to);

    Optional<MealLogEntry> findByIdAndUserId(Long id, Long userId);

    Optional<MealLogEntry> findByUserIdAndPlannedMealId(Long userId, Long plannedMealId);

    /** The oldest thing in the log, so the screen knows how far back to offer. */
    Optional<MealLogEntry> findFirstByUserIdOrderByDateAsc(Long userId);
}
