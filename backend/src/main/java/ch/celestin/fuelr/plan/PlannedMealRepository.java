package ch.celestin.fuelr.plan;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface PlannedMealRepository extends JpaRepository<PlannedMeal, Long> {

    /** Both bounds inclusive: a week is seven days, not six and a bit. */
    List<PlannedMeal> findByUserIdAndDateBetweenOrderByDateAscSlotAscPositionAsc(
            Long userId, LocalDate from, LocalDate to);

    List<PlannedMeal> findByUserIdAndDateAndSlotOrderByPositionAsc(
            Long userId, LocalDate date, MealSlot slot);

    Optional<PlannedMeal> findByIdAndUserId(Long id, Long userId);
}
