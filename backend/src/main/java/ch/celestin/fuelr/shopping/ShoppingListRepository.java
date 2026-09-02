package ch.celestin.fuelr.shopping;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Optional;

public interface ShoppingListRepository extends JpaRepository<ShoppingList, Long> {

    Optional<ShoppingList> findByHouseholdIdAndWeekStart(Long householdId, LocalDate weekStart);

    /** Same race as the household, same answer: let the constraint decide. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = """
            INSERT INTO shopping_lists (household_id, week_start) VALUES (:householdId, :weekStart)
            ON CONFLICT (household_id, week_start) DO NOTHING
            """, nativeQuery = true)
    void createIfAbsent(@Param("householdId") Long householdId,
                        @Param("weekStart") LocalDate weekStart);
}
