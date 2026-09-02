package ch.celestin.fuelr.plan;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface HouseholdRepository extends JpaRepository<Household, Long> {

    Optional<Household> findByOwnerUserId(Long ownerUserId);

    /**
     * Creates the household unless it is already there, in one statement.
     *
     * Read-then-insert loses a race that happens on a very ordinary page: two
     * requests fired in parallel for somebody who has never had a household
     * both find nothing, both insert, and one comes back a 500 on the first
     * visit of a new account. The unique constraint is the arbiter, and
     * {@code ON CONFLICT} is how to consult it without an exception.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = """
            INSERT INTO households (owner_user_id) VALUES (:userId)
            ON CONFLICT (owner_user_id) DO NOTHING
            """, nativeQuery = true)
    void createIfAbsent(@Param("userId") Long userId);
}
