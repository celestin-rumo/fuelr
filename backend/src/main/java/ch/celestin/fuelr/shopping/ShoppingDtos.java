package ch.celestin.fuelr.shopping;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class ShoppingDtos {

    private ShoppingDtos() {
    }

    /**
     * The week's list, already grouped. Grouping on the server keeps one
     * ordering of the aisles — the order a shop is walked — rather than one
     * per client that has to be kept in step.
     */
    public record ShoppingListView(
            Long id,
            LocalDate weekStart,
            Instant generatedAt,
            List<AisleGroup> aisles,
            /** Lines the cupboard already covers. Shown, never bought. */
            List<ItemView> covered,
            int remaining) {
    }

    public record AisleGroup(String aisle, List<ItemView> items) {
    }

    /**
     * {@code quantity} is what the week needs, {@code inStock} what the
     * cupboard holds, {@code toBuy} the difference. All three travel because a
     * line that says "buy 300 g" without saying why is a line people distrust.
     */
    public record ItemView(
            Long id,
            String name,
            Double quantity,
            String unit,
            String aisle,
            String source,
            Double inStock,
            Double toBuy,
            boolean checked,
            Instant checkedAt) {
    }

    /** A free item: a name, and optionally an amount. */
    public record AddItemRequest(
            @NotBlank String name,
            @Positive Double quantity,
            String unit) {
    }

    /**
     * {@code at} is when the tick happened on the device, which is not when it
     * arrives here. A phone in a basement ticks at 17:02 and syncs at 17:20.
     */
    public record CheckRequest(boolean checked, Instant at) {
    }

    /** One flush of everything a device ticked while it had no network. */
    public record SyncRequest(@NotNull List<SyncItem> items) {
    }

    public record SyncItem(@NotNull Long id, boolean checked, Instant at) {
    }

    public record PantryItemView(
            Long id, String name, double quantity, String unit, Instant updatedAt) {
    }

    public record PantryRequest(
            @NotBlank String name,
            @NotNull @Positive Double quantity,
            @NotBlank String unit) {
    }
}
