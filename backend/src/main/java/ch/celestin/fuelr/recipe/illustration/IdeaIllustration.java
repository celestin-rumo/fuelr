package ch.celestin.fuelr.recipe.illustration;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/** A picture drawn for a proposed dish, waiting to be kept or swept. */
@Entity
@Table(name = "idea_illustrations")
public class IdeaIllustration {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "title_key", nullable = false, length = 64)
    private String titleKey;

    @Column(nullable = false)
    private String title;

    @Column(name = "photo_path", nullable = false)
    private String photoPath;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected IdeaIllustration() {
    }

    public IdeaIllustration(Long userId, String titleKey, String title, String photoPath) {
        this.userId = userId;
        this.titleKey = titleKey;
        this.title = title;
        this.photoPath = photoPath;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public String getTitleKey() {
        return titleKey;
    }

    public String getTitle() {
        return title;
    }

    public String getPhotoPath() {
        return photoPath;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
