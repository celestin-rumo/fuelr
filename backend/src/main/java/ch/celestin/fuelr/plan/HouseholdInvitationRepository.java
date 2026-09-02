package ch.celestin.fuelr.plan;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface HouseholdInvitationRepository extends JpaRepository<HouseholdInvitation, Long> {

    Optional<HouseholdInvitation> findByTokenHash(String tokenHash);

    List<HouseholdInvitation> findByHouseholdIdAndAcceptedAtIsNullOrderByIdDesc(Long householdId);
}
