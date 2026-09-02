package ch.celestin.fuelr.nutrition;

import org.springframework.data.jpa.repository.JpaRepository;

public interface FoodRepository extends JpaRepository<Food, Long> {

    void deleteBySource(String source);
}
