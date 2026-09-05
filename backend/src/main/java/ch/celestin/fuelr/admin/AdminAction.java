package ch.celestin.fuelr.admin;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/** One thing an operator did to somebody else's account. See V23. */
@Entity
@Table(name = "admin_actions")
public class AdminAction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "actor_user_id")
    private Long actorUserId;

    @Column(name = "actor_email", nullable = false)
    private String actorEmail;

    @Column(nullable = false)
    private String action;

    @Column(name = "subject_user_id")
    private Long subjectUserId;

    @Column(name = "subject_email", nullable = false)
    private String subjectEmail;

    @Column
    private String detail;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected AdminAction() {
    }

    public AdminAction(Long actorUserId, String actorEmail, String action,
                       Long subjectUserId, String subjectEmail, String detail) {
        this.actorUserId = actorUserId;
        this.actorEmail = actorEmail;
        this.action = action;
        this.subjectUserId = subjectUserId;
        this.subjectEmail = subjectEmail;
        this.detail = detail;
    }

    public Long getId() {
        return id;
    }

    public String getActorEmail() {
        return actorEmail;
    }

    public String getAction() {
        return action;
    }

    public Long getSubjectUserId() {
        return subjectUserId;
    }

    public String getSubjectEmail() {
        return subjectEmail;
    }

    public String getDetail() {
        return detail;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
