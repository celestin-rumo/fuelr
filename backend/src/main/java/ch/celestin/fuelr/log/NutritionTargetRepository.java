package ch.celestin.fuelr.log;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface NutritionTargetRepository extends JpaRepository<NutritionTarget, Long> {

    Optional<NutritionTarget> findByUserId(Long userId);
}
