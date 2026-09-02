package ch.celestin.fuelr.shopping;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PantryItemRepository extends JpaRepository<PantryItem, Long> {

    List<PantryItem> findByHouseholdIdOrderByNameAsc(Long householdId);

    Optional<PantryItem> findByHouseholdIdAndMatchNameAndUnit(
            Long householdId, String matchName, String unit);

    Optional<PantryItem> findByIdAndHouseholdId(Long id, Long householdId);
}
