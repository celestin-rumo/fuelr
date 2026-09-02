package ch.celestin.fuelr.nutrition;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface FoodImportRepository extends JpaRepository<FoodImport, Long> {

    Optional<FoodImport> findBySource(String source);
}
