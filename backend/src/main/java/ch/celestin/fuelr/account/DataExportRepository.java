package ch.celestin.fuelr.account;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface DataExportRepository extends JpaRepository<DataExport, Long> {
    Optional<DataExport> findByTokenHash(String tokenHash);

    List<DataExport> findByUserId(Long userId);

    List<DataExport> findByExpiresAtBefore(Instant when);
}
