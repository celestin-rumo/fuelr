package ch.celestin.fuelr.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.UUID;

public interface SessionRepository extends JpaRepository<Session, UUID> {

    @Modifying
    @Query("delete from Session s where s.userId = :userId and s.id <> :keep")
    int deleteOtherSessions(@Param("userId") Long userId, @Param("keep") UUID keep);

    @Modifying
    @Query("delete from Session s where s.userId = :userId")
    int deleteAllForUser(@Param("userId") Long userId);

    @Modifying
    @Query("delete from Session s where s.expiresAt < :now")
    int deleteExpired(@Param("now") Instant now);
}
