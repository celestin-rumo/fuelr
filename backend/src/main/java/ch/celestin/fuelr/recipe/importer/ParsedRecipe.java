package ch.celestin.fuelr.recipe.importer;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * What a page said, before any of it is trusted.
 *
 * Every field is optional because pages are. {@code unverified} carries the
 * names of the values that had to be guessed rather than read, so the editor
 * can ask for them instead of presenting an invention as a fact.
 */
public class ParsedRecipe {

    private String title;
    private String description;
    private String imageUrl;
    private Integer servings;
    private Integer totalMinutes;
    private final List<ParsedIngredient> ingredients = new ArrayList<>();
    private final List<String> steps = new ArrayList<>();
    /** Only ever the library's own filter values — see the readers. */
    private final Set<String> tags = new LinkedHashSet<>();
    private final Set<String> unverified = new LinkedHashSet<>();

    public record ParsedIngredient(String name, double quantity, String unit, boolean needsReview) {
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

    /**
     * The photo the page announced, as an absolute URL — never the bytes.
     *
     * A URL a stranger chose is the same server-side request forgery as the
     * page itself, so whether it is fetched at all, and what happens to what
     * comes back, is decided well away from a parser.
     */
    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public Integer getServings() {
        return servings;
    }

    public void setServings(Integer servings) {
        this.servings = servings;
    }

    public Integer getTotalMinutes() {
        return totalMinutes;
    }

    public void setTotalMinutes(Integer totalMinutes) {
        this.totalMinutes = totalMinutes;
    }

    public List<ParsedIngredient> getIngredients() {
        return ingredients;
    }

    public List<String> getSteps() {
        return steps;
    }

    public Set<String> getTags() {
        return tags;
    }

    public Set<String> getUnverified() {
        return unverified;
    }

    public void flag(String field) {
        unverified.add(field);
    }

    /** True when the page yielded nothing worth opening an editor for. */
    public boolean isEmpty() {
        return (title == null || title.isBlank()) && ingredients.isEmpty() && steps.isEmpty();
    }
}
