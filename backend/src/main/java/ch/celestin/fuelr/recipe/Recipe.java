package ch.celestin.fuelr.recipe;

import jakarta.persistence.CascadeType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * A recipe, from the moment the editor is opened.
 *
 * Everything except the owner is nullable or empty on purpose: the draft is
 * created before the author has typed anything, so an incomplete row is a
 * normal state rather than a validation failure. Completeness is only checked
 * when the recipe is published.
 */
@Entity
@Table(name = "recipes")
public class Recipe {

    public enum Status { DRAFT, PUBLISHED }

    /**
     * How a recipe came to exist: somebody typed it, an import read it from a
     * page, or a model invented it when the week was filled.
     *
     * Closed, and set by the code that creates the recipe. A cook can correct
     * everything about an AI recipe — its title, its quantities, its steps —
     * and it stays an AI recipe, because that is a fact about where it came
     * from rather than about what it says now.
     */
    public enum Origin { TYPED, IMPORTED, AI }

    /** Where the photo came from; GENERATED is the one the screen has to confess. */
    public enum PhotoOrigin { UPLOADED, IMPORTED, GENERATED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @Column(nullable = false)
    private int servings = 4;

    @Column
    private String level;

    @Column(nullable = false)
    private String status = Status.DRAFT.name();

    @Column(nullable = false)
    private boolean favorite = false;

    /** File name on the media volume. Null when the recipe has no photo. */
    @Column(name = "photo_path")
    private String photoPath;

    /** Null on rows older than the column, which all held photos somebody chose. */
    @Column(name = "photo_origin", length = 16)
    private String photoOrigin;

    /** Position among the pinned recipes. Null when not pinned. */
    @Column(name = "favorite_rank")
    private Integer favoriteRank;

    /** Where an imported recipe came from, so it can be credited and rechecked. */
    @Column(name = "source_url", length = 2048)
    private String sourceUrl;

    /**
     * Where this recipe came from.
     *
     * Provenance rather than a tag: the tags describe the dish and are ticked
     * by hand, so a marker saying "a model wrote this" cannot be one of them —
     * the day somebody can tick it themselves it stops meaning anything. It is
     * written by the code that creates the recipe and never by the editor.
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Origin origin = Origin.TYPED;

    /**
     * A duration the source stated. Null means nobody said, and the total goes
     * back to being inferred from the step text — one number, one source.
     */
    @Column(name = "total_minutes")
    private Integer totalMinutes;

    /** Comma-separated names of fields an import had to guess at. */
    @Column(length = 120)
    private String unverified;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @JoinColumn(name = "recipe_id", nullable = false)
    @OrderColumn(name = "position")
    private List<RecipeIngredient> ingredients = new ArrayList<>();

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @JoinColumn(name = "recipe_id", nullable = false)
    @OrderColumn(name = "position")
    private List<RecipeStep> steps = new ArrayList<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "recipe_tags", joinColumns = @JoinColumn(name = "recipe_id"))
    @Column(name = "tag", nullable = false)
    private Set<String> tags = new LinkedHashSet<>();

    /**
     * Zero, one or several. A closed domain, unlike {@link #tags}, which is
     * what lets "what is in season now" be derived from the date rather than
     * guessed from what somebody typed.
     */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "recipe_seasons", joinColumns = @JoinColumn(name = "recipe_id"))
    @Column(name = "season", nullable = false)
    private Set<String> seasons = new LinkedHashSet<>();

    /**
     * At most one, and usually none. A column rather than a collection because
     * a dish is not of two cuisines at a time — see {@link Cuisine}.
     */
    @Column
    private String cuisine;

    protected Recipe() {
    }

    public Recipe(Long userId) {
        this.userId = userId;
    }

    @PreUpdate
    void touch() {
        this.updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public int getServings() {
        return servings;
    }

    public void setServings(int servings) {
        this.servings = servings;
    }

    public String getLevel() {
        return level;
    }

    public void setLevel(String level) {
        this.level = level;
    }

    public Status getStatus() {
        return Status.valueOf(status);
    }

    public void setStatus(Status status) {
        this.status = status.name();
    }

    public boolean isFavorite() {
        return favorite;
    }

    public void setFavorite(boolean favorite) {
        this.favorite = favorite;
    }

    public String getPhotoPath() {
        return photoPath;
    }

    public void setPhotoPath(String photoPath) {
        this.photoPath = photoPath;
    }

    public PhotoOrigin getPhotoOrigin() {
        return photoOrigin == null ? null : PhotoOrigin.valueOf(photoOrigin);
    }

    public void setPhotoOrigin(PhotoOrigin origin) {
        this.photoOrigin = origin == null ? null : origin.name();
    }

    /** Only an illustration is confessed as one; a photo somebody chose is a photo. */
    public boolean isPhotoGenerated() {
        return photoPath != null && PhotoOrigin.GENERATED.name().equals(photoOrigin);
    }

    public Integer getFavoriteRank() {
        return favoriteRank;
    }

    public Origin getOrigin() {
        return origin;
    }

    public void setOrigin(Origin origin) {
        this.origin = origin;
    }

    public String getSourceUrl() {
        return sourceUrl;
    }

    public void setSourceUrl(String sourceUrl) {
        this.sourceUrl = sourceUrl;
    }

    public Integer getTotalMinutes() {
        return totalMinutes;
    }

    public void setTotalMinutes(Integer totalMinutes) {
        this.totalMinutes = totalMinutes;
    }

    public String getUnverified() {
        return unverified;
    }

    public void setUnverified(String unverified) {
        this.unverified = unverified;
    }

    public void setFavoriteRank(Integer favoriteRank) {
        this.favoriteRank = favoriteRank;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public List<RecipeIngredient> getIngredients() {
        return ingredients;
    }

    public List<RecipeStep> getSteps() {
        return steps;
    }

    public Set<String> getTags() {
        return tags;
    }

    public Set<String> getSeasons() {
        return seasons;
    }

    public String getCuisine() {
        return cuisine;
    }

    /** Null clears it, which is the normal state for most recipes. */
    public void setCuisine(Cuisine cuisine) {
        this.cuisine = cuisine == null ? null : cuisine.name();
    }
}
