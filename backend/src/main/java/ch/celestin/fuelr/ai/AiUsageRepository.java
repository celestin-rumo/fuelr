package ch.celestin.fuelr.ai;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public interface AiUsageRepository extends JpaRepository<AiUsage, Long> {

    /** Nothing spent is an empty sum, not a zero row — hence the coalesce. */
    @Query("""
            select coalesce(sum(u.costMicros), 0) from AiUsage u
            where u.userId = :userId and u.period = :period""")
    long spentIn(@Param("userId") Long userId, @Param("period") LocalDate period);

    /**
     * One line per account, over every month from {@code from} onwards.
     *
     * A date rather than a nullable "this month or everything" flag: Postgres
     * cannot infer the type of a bare null parameter, and a real lower bound
     * reads better anyway — {@link AiBudget#BEGINNING} is "since the start".
     * The email is joined in because a report naming account 4 939 is a report
     * nobody can act on.
     */
    @Query("""
            select u.userId as userId, a.email as email,
                   count(u) as calls,
                   coalesce(sum(u.inputTokens), 0) as inputTokens,
                   coalesce(sum(u.outputTokens), 0) as outputTokens,
                   coalesce(sum(u.costMicros), 0) as costMicros,
                   max(u.createdAt) as lastCall
            from AiUsage u join User a on a.id = u.userId
            where u.period >= :from
            group by u.userId, a.email
            order by coalesce(sum(u.costMicros), 0) desc""")
    List<PerAccount> perAccountSince(@Param("from") LocalDate from);

    /** What each kind of read has cost, which is what a quota is set from. */
    @Query("""
            select u.operation as operation,
                   count(u) as calls,
                   coalesce(sum(u.inputTokens), 0) as inputTokens,
                   coalesce(sum(u.outputTokens), 0) as outputTokens,
                   coalesce(sum(u.costMicros), 0) as costMicros
            from AiUsage u
            where u.period >= :from
            group by u.operation
            order by coalesce(sum(u.costMicros), 0) desc""")
    List<PerOperation> perOperationSince(@Param("from") LocalDate from);

    /** Spring maps a projection interface onto the aliases above. */
    interface PerAccount {
        Long getUserId();

        String getEmail();

        long getCalls();

        long getInputTokens();

        long getOutputTokens();

        long getCostMicros();

        Instant getLastCall();
    }

    interface PerOperation {
        String getOperation();

        long getCalls();

        long getInputTokens();

        long getOutputTokens();

        long getCostMicros();
    }
}
