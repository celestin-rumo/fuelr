package ch.celestin.fuelr.nutrition;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface FoodMicronutrientRepository
        extends JpaRepository<FoodMicronutrient, FoodMicronutrient.Key> {

    List<FoodMicronutrient> findByFoodIdIn(Collection<Long> foodIds);
}
