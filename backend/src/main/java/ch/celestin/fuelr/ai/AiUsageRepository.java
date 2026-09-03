package ch.celestin.fuelr.ai;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;

public interface AiUsageRepository extends JpaRepository<AiUsage, Long> {

    /** Nothing spent is an empty sum, not a zero row — hence the coalesce. */
    @Query("""
            select coalesce(sum(u.costMicros), 0) from AiUsage u
            where u.userId = :userId and u.period = :period""")
    long spentIn(@Param("userId") Long userId, @Param("period") LocalDate period);
}
