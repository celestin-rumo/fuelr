package ch.celestin.fuelr.shopping;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * One line of the list.
 *
 * {@code checkedAt} is an instant rather than a boolean because a phone in a
 * basement ticks things off with no network and syncs them later: the two
 * copies are reconciled by which tick happened last, and a boolean cannot say.
 */
@Entity
@Table(name = "shopping_items")
public class ShoppingItem {

    /** PLAN lines are rebuilt from the week; MANUAL lines are never touched. */
    public enum Source { PLAN, MANUAL }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "list_id", nullable = false)
    private Long listId;

    @Column(nullable = false)
    private String name;

    @Column(name = "match_name", nullable = false)
    private String matchName;

    /** Null for a free item somebody typed with no amount. */
    @Column
    private BigDecimal quantity;

    @Column(nullable = false)
    private String unit;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Aisle aisle;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Source source;

    @Column(name = "checked_at")
    private Instant checkedAt;

    /** When the tick last changed, ticks and unticks alike. */
    @Column(name = "checked_updated_at")
    private Instant checkedUpdatedAt;

    protected ShoppingItem() {
    }

    public ShoppingItem(Long listId, String name, String matchName, BigDecimal quantity,
                        String unit, Aisle aisle, Source source) {
        this.listId = listId;
        this.name = name;
        this.matchName = matchName;
        this.quantity = quantity;
        this.unit = unit;
        this.aisle = aisle;
        this.source = source;
    }

    public boolean isChecked() {
        return checkedAt != null;
    }

    /**
     * Ticks or unticks, keeping whichever change happened last.
     *
     * Two phones in the same shop tick different things and sync in whatever
     * order the network allows. Without this, the reply from the slow one
     * silently undoes the fast one.
     */
    public void applyCheck(Instant when, boolean checked) {
        Instant at = when == null ? Instant.now() : when;
        if (checkedUpdatedAt != null && at.isBefore(checkedUpdatedAt)) {
            return;
        }
        this.checkedAt = checked ? at : null;
        this.checkedUpdatedAt = at;
    }

    public Long getId() {
        return id;
    }

    public Long getListId() {
        return listId;
    }

    public String getName() {
        return name;
    }

    public String getMatchName() {
        return matchName;
    }

    public BigDecimal getQuantity() {
        return quantity;
    }

    public void setQuantity(BigDecimal quantity) {
        this.quantity = quantity;
    }

    public String getUnit() {
        return unit;
    }

    public Aisle getAisle() {
        return aisle;
    }

    public void setAisle(Aisle aisle) {
        this.aisle = aisle;
    }

    public Source getSource() {
        return source;
    }

    public Instant getCheckedAt() {
        return checkedAt;
    }
}
