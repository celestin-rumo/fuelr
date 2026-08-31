package ch.celestin.fuelr.nutrition;

import org.springframework.data.jpa.repository.JpaRepository;

public interface FoodNutritionRepository extends JpaRepository<FoodNutrition, Long> {
}
