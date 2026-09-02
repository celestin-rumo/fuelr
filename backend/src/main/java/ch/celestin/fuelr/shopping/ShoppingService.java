package ch.celestin.fuelr.shopping;

import ch.celestin.fuelr.nutrition.NutritionService;
import ch.celestin.fuelr.plan.Household;
import ch.celestin.fuelr.plan.HouseholdService;
import ch.celestin.fuelr.plan.PlanDtos.PlannedIngredientView;
import ch.celestin.fuelr.plan.PlanService;
import ch.celestin.fuelr.shopping.ShoppingDtos.AddItemRequest;
import ch.celestin.fuelr.shopping.ShoppingDtos.AisleGroup;
import ch.celestin.fuelr.shopping.ShoppingDtos.ItemView;
import ch.celestin.fuelr.shopping.ShoppingDtos.PantryRequest;
import ch.celestin.fuelr.shopping.ShoppingDtos.ShoppingListView;
import ch.celestin.fuelr.shopping.ShoppingDtos.SyncItem;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * The week's plan, turned into what has to be bought.
 *
 * The list is stored rather than derived on every read, and that is the point:
 * a ticked box is a fact about somebody standing in a shop. Regenerating
 * merges into the rows that are already there — quantities are recomputed,
 * ticks and free items are left exactly where they were.
 */
@Service
public class ShoppingService {

    /** A free item nobody gave an amount for. */
    static final String NO_UNIT = "";

    public static class NotAFreeItemException extends RuntimeException {
        public NotAFreeItemException() {
            super("not_a_free_item");
        }
    }

    private final ShoppingListRepository lists;
    private final ShoppingItemRepository items;
    private final PantryService pantry;
    private final HouseholdService households;
    private final PlanService plan;
    private final NutritionService nutrition;

    public ShoppingService(ShoppingListRepository lists, ShoppingItemRepository items,
                           PantryService pantry, HouseholdService households,
                           PlanService plan, NutritionService nutrition) {
        this.lists = lists;
        this.items = items;
        this.pantry = pantry;
        this.households = households;
        this.plan = plan;
        this.nutrition = nutrition;
    }

    /** Lowercased and squeezed, so two spellings of one thing meet. */
    static String matchName(String name) {
        return name.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }

    // --- reading ------------------------------------------------------------

    /**
     * The list for a week, brought up to date with the plan first.
     *
     * Reading regenerates on purpose. The list *is* the plan's projection plus
     * whatever was added and ticked by hand, so a list that only followed the
     * plan when somebody remembered to press a button would be wrong most of
     * the time — and the merge below is what makes doing it on every read
     * harmless.
     */
    @Transactional
    public ShoppingListView list(Long userId, LocalDate anyDay) {
        Household household = households.activeHouseholdFor(userId);
        LocalDate weekStart = PlanService.weekStart(anyDay);
        ShoppingList list = listFor(household.getId(), weekStart);
        regenerate(userId, list, weekStart);
        return view(household.getId(), list);
    }

    // --- writing ------------------------------------------------------------

    @Transactional
    public ShoppingListView check(Long userId, Long itemId, boolean checked, java.time.Instant at) {
        Household household = households.activeHouseholdFor(userId);
        ShoppingItem item = owned(household.getId(), itemId);
        item.applyCheck(at, checked);
        items.save(item);
        return view(household.getId(), lists.findById(item.getListId()).orElseThrow());
    }

    /**
     * One flush of everything a device ticked with no network.
     *
     * Unknown ids are skipped rather than refused: the list may have been
     * regenerated since, and a phone coming back from a basement must not be
     * told its whole trip was invalid.
     */
    @Transactional
    public ShoppingListView sync(Long userId, LocalDate anyDay, List<SyncItem> ticks) {
        Household household = households.activeHouseholdFor(userId);
        for (SyncItem tick : ticks) {
            items.findById(tick.id())
                    .filter(item -> belongsTo(household.getId(), item))
                    .ifPresent(item -> {
                        item.applyCheck(tick.at(), tick.checked());
                        items.save(item);
                    });
        }
        return list(userId, anyDay);
    }

    @Transactional
    public ShoppingListView addFreeItem(Long userId, LocalDate anyDay, AddItemRequest request) {
        Household household = households.activeHouseholdFor(userId);
        LocalDate weekStart = PlanService.weekStart(anyDay);
        ShoppingList list = listFor(household.getId(), weekStart);

        String name = request.name().trim();
        String unit = request.unit() == null ? NO_UNIT : request.unit().trim();
        String key = matchName(name);

        // Adding something already on the list is not an error; it is somebody
        // saying they want more of it.
        Optional<ShoppingItem> existing =
                items.findByListIdAndMatchNameAndUnit(list.getId(), key, unit);
        if (existing.isPresent()) {
            ShoppingItem item = existing.get();
            if (request.quantity() != null && item.getQuantity() != null) {
                item.setQuantity(item.getQuantity().add(BigDecimal.valueOf(request.quantity())));
                items.save(item);
            }
        } else {
            items.save(new ShoppingItem(
                    list.getId(), name, key,
                    request.quantity() == null ? null : BigDecimal.valueOf(request.quantity()),
                    unit, aisleOf(name), ShoppingItem.Source.MANUAL));
        }
        return view(household.getId(), list);
    }

    /**
     * Removes a free item. A line that came from the plan is not removable —
     * it would be back on the next read, and the honest way to stop buying it
     * is the cupboard or the plan.
     */
    @Transactional
    public ShoppingListView removeFreeItem(Long userId, Long itemId) {
        Household household = households.activeHouseholdFor(userId);
        ShoppingItem item = owned(household.getId(), itemId);
        if (item.getSource() != ShoppingItem.Source.MANUAL) {
            throw new NotAFreeItemException();
        }
        Long listId = item.getListId();
        items.delete(item);
        return view(household.getId(), lists.findById(listId).orElseThrow());
    }

    // --- internals ----------------------------------------------------------

    private ShoppingList listFor(Long householdId, LocalDate weekStart) {
        return lists.findByHouseholdIdAndWeekStart(householdId, weekStart).orElseGet(() -> {
            // Two members opening the list at the same moment, or one member
            // whose page fires two requests at once. The unique constraint is
            // the arbiter, and both then read the same row.
            lists.createIfAbsent(householdId, weekStart);
            return lists.findByHouseholdIdAndWeekStart(householdId, weekStart).orElseThrow();
        });
    }

    /**
     * Brings the PLAN lines in step with the week, and touches nothing else.
     *
     * Quantities are recomputed, lines the week no longer needs are dropped,
     * new ones are added — and every tick, and every free item, survives it.
     */
    private void regenerate(Long userId, ShoppingList list, LocalDate weekStart) {
        Map<String, Aggregate> needed = aggregate(plan.ingredients(userId, weekStart));
        List<ShoppingItem> existing = items.findByListIdOrderByIdAsc(list.getId());

        for (ShoppingItem item : existing) {
            if (item.getSource() != ShoppingItem.Source.PLAN) {
                continue;
            }
            Aggregate match = needed.remove(key(item.getMatchName(), item.getUnit()));
            if (match == null) {
                // Nothing this week needs it any more. Its tick means nothing
                // either, which is why the row goes rather than being kept.
                items.delete(item);
            } else if (item.getQuantity() == null
                    || item.getQuantity().compareTo(match.quantity) != 0) {
                item.setQuantity(match.quantity);
                items.save(item);
            }
        }

        for (Aggregate line : needed.values()) {
            // A free item with the same name and unit already covers it: the
            // cook wrote it down before the plan asked for it.
            if (items.findByListIdAndMatchNameAndUnit(
                    list.getId(), line.matchName, line.unit).isPresent()) {
                continue;
            }
            items.save(new ShoppingItem(
                    list.getId(), line.name, line.matchName, line.quantity, line.unit,
                    aisleOf(line.name), ShoppingItem.Source.PLAN));
        }

        list.regenerated();
        lists.save(list);
    }

    /** Same name, same unit, one line. Different units stay apart. */
    private static Map<String, Aggregate> aggregate(List<PlannedIngredientView> lines) {
        Map<String, Aggregate> byKey = new LinkedHashMap<>();
        for (PlannedIngredientView line : lines) {
            String matchName = matchName(line.name());
            byKey.compute(key(matchName, line.unit()), (ignored, current) -> current == null
                    ? new Aggregate(line.name().trim(), matchName, line.unit(),
                            BigDecimal.valueOf(line.quantity()))
                    : current.plus(BigDecimal.valueOf(line.quantity())));
        }
        return byKey;
    }

    /**
     * How a line is identified: its name and its unit together.
     *
     * One definition, used by everything that matches a list line against a
     * cupboard shelf. There were two once — a space on one side and a nul byte
     * on the other — and the cupboard silently stopped covering anything,
     * while both keys printed identically.
     */
    static String key(String matchName, String unit) {
        return matchName + "|" + unit;
    }

    private record Aggregate(String name, String matchName, String unit, BigDecimal quantity) {
        Aggregate plus(BigDecimal more) {
            return new Aggregate(name, matchName, unit, quantity.add(more));
        }
    }

    private Aisle aisleOf(String name) {
        return Aisle.parse(nutrition.aisleOf(name));
    }

    private ShoppingItem owned(Long householdId, Long itemId) {
        ShoppingItem item = items.findById(itemId).orElse(null);
        if (item == null || !belongsTo(householdId, item)) {
            // Somebody else's list is reported as missing, not as forbidden.
            throw new java.util.NoSuchElementException("unknown_item");
        }
        return item;
    }

    private boolean belongsTo(Long householdId, ShoppingItem item) {
        return lists.findById(item.getListId())
                .map(list -> list.getHouseholdId().equals(householdId))
                .orElse(false);
    }

    private ShoppingListView view(Long householdId, ShoppingList list) {
        Map<String, PantryItem> stock = pantry.stockOf(householdId);

        Map<Aisle, List<ItemView>> byAisle = new LinkedHashMap<>();
        List<ItemView> covered = new ArrayList<>();
        int remaining = 0;

        for (ShoppingItem item : items.findByListIdOrderByIdAsc(list.getId())) {
            PantryItem inStock = stock.get(key(item.getMatchName(), item.getUnit()));
            double have = inStock == null ? 0 : inStock.getQuantity().doubleValue();
            Double need = item.getQuantity() == null ? null : item.getQuantity().doubleValue();
            Double toBuy = need == null ? null : Math.max(0, round(need - have));

            ItemView view = new ItemView(
                    item.getId(), item.getName(), need == null ? null : round(need),
                    item.getUnit(), item.getAisle().name(), item.getSource().name(),
                    inStock == null ? null : round(have), toBuy,
                    item.isChecked(), item.getCheckedAt());

            if (toBuy != null && toBuy == 0 && have > 0) {
                // Already at home. Shown rather than hidden, so nobody wonders
                // where the flour went.
                covered.add(view);
                continue;
            }
            byAisle.computeIfAbsent(item.getAisle(), ignored -> new ArrayList<>()).add(view);
            if (!item.isChecked()) {
                remaining++;
            }
        }

        // Walked in the order of the enum, which is the order of a shop.
        List<AisleGroup> groups = new ArrayList<>();
        for (Aisle aisle : Aisle.values()) {
            List<ItemView> group = byAisle.get(aisle);
            if (group != null && !group.isEmpty()) {
                groups.add(new AisleGroup(aisle.name(), group));
            }
        }

        return new ShoppingListView(
                list.getId(), list.getWeekStart(), list.getGeneratedAt(),
                groups, covered, remaining);
    }

    private static double round(double value) {
        return Math.round(value * 10d) / 10d;
    }
}
