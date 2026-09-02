package ch.celestin.fuelr.nutrition;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

import java.io.Serializable;
import java.math.BigDecimal;
import java.util.Objects;

/** One measured value past the macros, per 100 g / 100 ml. */
@Entity
@Table(name = "food_micronutrients")
@IdClass(FoodMicronutrient.Key.class)
public class FoodMicronutrient {

    @Id
    @Column(name = "food_id")
    private Long foodId;

    @Id
    @Column
    private String code;

    @Column(nullable = false)
    private BigDecimal amount;

    @Column(nullable = false)
    private String unit;

    protected FoodMicronutrient() {
    }

    public FoodMicronutrient(Long foodId, String code, BigDecimal amount, String unit) {
        this.foodId = foodId;
        this.code = code;
        this.amount = amount;
        this.unit = unit;
    }

    public Long getFoodId() {
        return foodId;
    }

    public String getCode() {
        return code;
    }

    public double getAmount() {
        return amount.doubleValue();
    }

    public String getUnit() {
        return unit;
    }

    public static class Key implements Serializable {
        private Long foodId;
        private String code;

        public Key() {
        }

        public Key(Long foodId, String code) {
            this.foodId = foodId;
            this.code = code;
        }

        @Override
        public boolean equals(Object other) {
            if (this == other) return true;
            if (!(other instanceof Key key)) return false;
            return Objects.equals(foodId, key.foodId) && Objects.equals(code, key.code);
        }

        @Override
        public int hashCode() {
            return Objects.hash(foodId, code);
        }
    }
}
