package ch.celestin.fuelr.shopping;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ShoppingItemRepository extends JpaRepository<ShoppingItem, Long> {

    List<ShoppingItem> findByListIdOrderByIdAsc(Long listId);

    Optional<ShoppingItem> findByListIdAndMatchNameAndUnit(
            Long listId, String matchName, String unit);
}
