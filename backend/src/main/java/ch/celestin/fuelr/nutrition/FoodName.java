package ch.celestin.fuelr.nutrition;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * A name or synonym a food can be written as, in one language.
 *
 * `normalised` is what matching runs on, and it is stored rather than computed
 * per query: the rule then has exactly one implementation on the Java side and
 * one in the generator, and a test holds the two to the same examples.
 */
@Entity
@Table(name = "food_names")
public class FoodName {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "food_id", nullable = false)
    private Long foodId;

    @Column(nullable = false)
    private String locale;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String normalised;

    protected FoodName() {
    }

    public FoodName(Long foodId, String locale, String name, String normalised) {
        this.foodId = foodId;
        this.locale = locale;
        this.name = name;
        this.normalised = normalised;
    }

    public Long getFoodId() {
        return foodId;
    }

    public String getLocale() {
        return locale;
    }

    public String getName() {
        return name;
    }

    public String getNormalised() {
        return normalised;
    }
}
