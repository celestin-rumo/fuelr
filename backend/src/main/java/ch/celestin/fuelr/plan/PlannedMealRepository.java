package ch.celestin.fuelr.plan;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface PlannedMealRepository extends JpaRepository<PlannedMeal, Long> {

    /** Both bounds inclusive: a week is seven days, not six and a bit. */
    List<PlannedMeal> findByHouseholdIdAndDateBetweenOrderByDateAscSlotAscPositionAsc(
            Long householdId, LocalDate from, LocalDate to);

    List<PlannedMeal> findByHouseholdIdAndDateAndSlotOrderByPositionAsc(
            Long householdId, LocalDate date, MealSlot slot);

    Optional<PlannedMeal> findByIdAndHouseholdId(Long id, Long householdId);

    /**
     * Whether a recipe is on this household's plan. It is what lets a member
     * open a dish somebody else put on Thursday — and nothing more than that.
     */
    boolean existsByHouseholdIdAndRecipeId(Long householdId, Long recipeId);
}
