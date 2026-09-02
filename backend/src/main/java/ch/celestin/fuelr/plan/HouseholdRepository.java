package ch.celestin.fuelr.plan;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface HouseholdRepository extends JpaRepository<Household, Long> {

    Optional<Household> findByOwnerUserId(Long ownerUserId);
}
