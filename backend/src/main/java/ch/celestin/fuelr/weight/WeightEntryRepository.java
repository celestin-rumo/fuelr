package ch.celestin.fuelr.weight;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface WeightEntryRepository extends JpaRepository<WeightEntry, Long> {
    Optional<WeightEntry> findByUserIdAndWeighedOn(Long userId, LocalDate day);

    List<WeightEntry> findByUserIdAndWeighedOnBetweenOrderByWeighedOnAsc(
            Long userId, LocalDate from, LocalDate to);

    Optional<WeightEntry> findFirstByUserIdOrderByWeighedOnDesc(Long userId);

    Optional<WeightEntry> findByIdAndUserId(Long id, Long userId);
}
