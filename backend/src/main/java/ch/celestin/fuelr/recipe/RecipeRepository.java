package ch.celestin.fuelr.recipe;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface RecipeRepository extends JpaRepository<Recipe, Long> {

    List<Recipe> findByUserIdOrderByFavoriteDescUpdatedAtDesc(Long userId);

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
     * what the count comparison enforces.
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
            """)
    List<Recipe> search(
            @Param("userId") Long userId,
            @Param("term") String term,
            @Param("tags") Collection<String> tags,
            @Param("tagCount") long tagCount);
}
