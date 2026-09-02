package ch.celestin.fuelr.shopping;

import ch.celestin.fuelr.plan.HouseholdService;
import ch.celestin.fuelr.plan.PlanDtos.PlannedIngredientView;
import ch.celestin.fuelr.shopping.ShoppingDtos.PantryRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * What is already at home.
 *
 * Deliberately knows nothing about the plan or the list. Cooking a meal takes
 * things out of the cupboard, and the cupboard covers part of the list — but
 * if this depended on planning, and planning notified it, the two would be in
 * a circle Spring could not construct.
 */
@Service
public class PantryService {

    private final PantryItemRepository pantry;
    private final HouseholdService households;

    public PantryService(PantryItemRepository pantry, HouseholdService households) {
        this.pantry = pantry;
        this.households = households;
    }

    public List<PantryItem> of(Long userId) {
        return pantry.findByHouseholdIdOrderByNameAsc(
                households.activeHouseholdFor(userId).getId());
    }

    /** Keyed by {@link ShoppingService#key}, which is the only definition of it. */
    public Map<String, PantryItem> stockOf(Long householdId) {
        Map<String, PantryItem> stock = new LinkedHashMap<>();
        for (PantryItem item : pantry.findByHouseholdIdOrderByNameAsc(householdId)) {
            stock.put(ShoppingService.key(item.getMatchName(), item.getUnit()), item);
        }
        return stock;
    }

    /** Declaring something already at home. Twice means more of it, not two rows. */
    @Transactional
    public PantryItem stock(Long userId, PantryRequest request) {
        Long householdId = households.activeHouseholdFor(userId).getId();
        String name = request.name().trim();
        String unit = request.unit().trim();
        String key = ShoppingService.matchName(name);
        return pantry.findByHouseholdIdAndMatchNameAndUnit(householdId, key, unit)
                .map(item -> {
                    item.setQuantity(BigDecimal.valueOf(request.quantity()));
                    item.setName(name);
                    return pantry.save(item);
                })
                .orElseGet(() -> pantry.save(new PantryItem(
                        householdId, name, key,
                        BigDecimal.valueOf(request.quantity()), unit)));
    }

    @Transactional
    public void unstock(Long userId, Long itemId) {
        Long householdId = households.activeHouseholdFor(userId).getId();
        pantry.findByIdAndHouseholdId(itemId, householdId).ifPresent(pantry::delete);
    }

    /**
     * Takes what a meal used out of the cupboard.
     *
     * A shelf that reaches zero is deleted rather than kept: "in stock: 0" is
     * not a fact worth storing, and it would go on covering nothing. What is
     * not in the cupboard is ignored — nobody has to declare everything they
     * own for this to be useful.
     */
    @Transactional
    public void consume(Long householdId, List<PlannedIngredientView> ingredients) {
        for (PlannedIngredientView line : ingredients) {
            pantry.findByHouseholdIdAndMatchNameAndUnit(
                            householdId, ShoppingService.matchName(line.name()), line.unit())
                    .ifPresent(item -> {
                        BigDecimal left = item.getQuantity()
                                .subtract(BigDecimal.valueOf(line.quantity()));
                        if (left.compareTo(BigDecimal.ZERO) <= 0) {
                            pantry.delete(item);
                        } else {
                            item.setQuantity(left);
                            pantry.save(item);
                        }
                    });
        }
    }
}
