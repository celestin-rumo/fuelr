package ch.celestin.fuelr.recipe.illustration;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface IdeaIllustrationRepository extends JpaRepository<IdeaIllustration, Long> {

    Optional<IdeaIllustration> findByUserIdAndTitleKey(Long userId, String titleKey);

    List<IdeaIllustration> findByCreatedAtBefore(Instant before);
}
