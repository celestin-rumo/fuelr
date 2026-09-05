package ch.celestin.fuelr.admin;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface AdminActionRepository extends JpaRepository<AdminAction, Long> {

    @Query("select a from AdminAction a order by a.createdAt desc limit 200")
    List<AdminAction> recent();

    List<AdminAction> findBySubjectUserIdOrderByCreatedAtDesc(Long subjectUserId);
}
