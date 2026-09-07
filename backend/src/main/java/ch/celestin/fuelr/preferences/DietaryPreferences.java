package ch.celestin.fuelr.preferences;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;

/** What one person does not eat, said once. */
@Entity
@Table(name = "dietary_preferences")
public class DietaryPreferences {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Diet diet = Diet.NONE;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "dietary_allergens", joinColumns = @JoinColumn(name = "user_id"))
    @Column(name = "allergen", length = 20)
    @Enumerated(EnumType.STRING)
    private Set<Allergen> allergens = new LinkedHashSet<>();

    /** Free text, 200 characters. It reaches a model, quoted, and nothing else. */
    @Column(length = 200)
    private String dislikes;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    protected DietaryPreferences() {
    }

    public DietaryPreferences(Long userId) {
        this.userId = userId;
    }

    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }

    public Diet getDiet() {
        return diet;
    }

    public void setDiet(Diet diet) {
        this.diet = diet == null ? Diet.NONE : diet;
    }

    public Set<Allergen> getAllergens() {
        return allergens;
    }

    public void setAllergens(Set<Allergen> allergens) {
        this.allergens = new LinkedHashSet<>(allergens);
    }

    public String getDislikes() {
        return dislikes;
    }

    public void setDislikes(String dislikes) {
        this.dislikes = dislikes == null || dislikes.isBlank() ? null
                : dislikes.strip().substring(0, Math.min(200, dislikes.strip().length()));
    }

    /** True when there is nothing here that could drop a dish. */
    public boolean isEmpty() {
        return diet == Diet.NONE && allergens.isEmpty();
    }
}
