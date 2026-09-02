package ch.celestin.fuelr.plan;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface HouseholdMemberRepository extends JpaRepository<HouseholdMember, Long> {

    Optional<HouseholdMember> findByUserId(Long userId);

    List<HouseholdMember> findByHouseholdIdOrderByJoinedAtAsc(Long householdId);

    long countByHouseholdId(Long householdId);
}
