package ch.celestin.fuelr.nutrition;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/** What was imported, and from which version of the file. */
@Entity
@Table(name = "food_imports")
public class FoodImport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String source;

    @Column(nullable = false)
    private String checksum;

    @Column(nullable = false)
    private int foods;

    @Column(name = "imported_at", nullable = false)
    private Instant importedAt = Instant.now();

    protected FoodImport() {
    }

    public FoodImport(String source, String checksum, int foods) {
        this.source = source;
        this.checksum = checksum;
        this.foods = foods;
    }

    public String getChecksum() {
        return checksum;
    }

    public void update(String checksum, int foods) {
        this.checksum = checksum;
        this.foods = foods;
        this.importedAt = Instant.now();
    }
}
