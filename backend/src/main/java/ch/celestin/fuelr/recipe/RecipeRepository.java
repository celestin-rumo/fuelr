package ch.celestin.fuelr.recipe;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface RecipeRepository extends JpaRepository<Recipe, Long> {

    List<Recipe> findByUserIdOrderByFavoriteDescUpdatedAtDesc(Long userId);

    List<Recipe> findByUserId(Long userId);

    long countByUserId(Long userId);

    Optional<Recipe> findByIdAndUserId(Long id, Long userId);

    /**
     * The recipes behind a set of planned meals, in one query. The week grid
     * shows up to 28 of them, and one lookup each would be 28 round trips for
     * a single screen.
     */
    List<Recipe> findByUserIdAndIdIn(Long userId, Collection<Long> ids);

    /**
     * Search runs in the database rather than over a fetched list: a library of
     * 200 recipes is the case this exists for.
     *
     * The term matches the title or any ingredient name. Tags are cumulative —
     * a recipe must carry every selected tag, not just one of them — which is
     * what the count comparison enforces. Seasons are the opposite and match
     * any: asking for autumn and winter asks for what can be cooked in either,
     * and a squash soup that is both appears once rather than twice.
     */
    @Query("""
            select distinct r from Recipe r
            where r.userId = :userId
              and (:term is null
                   or lower(r.title) like :term
                   or exists (select 1 from RecipeIngredient i
                              where i member of r.ingredients
                                and lower(i.name) like :term))
              and (:tagCount = 0
                   or (select count(distinct t) from Recipe r2 join r2.tags t
                       where r2 = r and t in :tags) = :tagCount)
              and (:seasonCount = 0
                   or exists (select 1 from Recipe r3 join r3.seasons s
                              where r3 = r and s in :seasons))
            """)
    List<Recipe> search(
            @Param("userId") Long userId,
            @Param("term") String term,
            @Param("tags") Collection<String> tags,
            @Param("tagCount") long tagCount,
            @Param("seasons") Collection<String> seasons,
            @Param("seasonCount") long seasonCount);
}
