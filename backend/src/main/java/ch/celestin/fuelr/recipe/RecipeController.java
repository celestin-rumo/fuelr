package ch.celestin.fuelr.recipe;

import ch.celestin.fuelr.recipe.RecipeDtos.IngredientView;
import ch.celestin.fuelr.recipe.RecipeDtos.RecipeSummary;
import ch.celestin.fuelr.recipe.RecipeDtos.RecipeView;
import ch.celestin.fuelr.recipe.RecipeDtos.SaveRequest;
import ch.celestin.fuelr.recipe.RecipeDtos.ValidationError;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/recipes")
public class RecipeController {

    private final RecipeService recipes;

    public RecipeController(RecipeService recipes) {
        this.recipes = recipes;
    }

    /** Opening the editor creates the draft; there is no form to fill first. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RecipeView createDraft(@AuthenticationPrincipal Jwt principal) {
        return toView(recipes.createDraft(userId(principal)));
    }

    @GetMapping
    public List<RecipeSummary> list(@AuthenticationPrincipal Jwt principal) {
        return recipes.list(userId(principal)).stream()
                .map(r -> new RecipeSummary(
                        r.getId(), r.getTitle(), r.getStatus().name(), r.getServings(),
                        r.getIngredients().size(), r.getSteps().size()))
                .toList();
    }

    @GetMapping("/{id}")
    public RecipeView get(@AuthenticationPrincipal Jwt principal, @PathVariable Long id) {
        return toView(owned(principal, id));
    }

    /** Autosave. Accepts an incomplete recipe by design. */
    @PutMapping("/{id}")
    public RecipeView save(
            @AuthenticationPrincipal Jwt principal,
            @PathVariable Long id,
            @Valid @RequestBody SaveRequest body) {
        return toView(recipes.save(owned(principal, id), body));
    }

    /**
     * Publishing is the only gate. On failure the response carries the field
     * that blocks it, so the editor can send the author to the right tab
     * rather than showing a generic error.
     */
    @PostMapping("/{id}/publish")
    public ResponseEntity<?> publish(
            @AuthenticationPrincipal Jwt principal, @PathVariable Long id) {
        Recipe recipe = owned(principal, id);
        List<ValidationError> errors = recipes.validate(recipe);
        if (!errors.isEmpty()) {
            return ResponseEntity.unprocessableEntity().body(errors);
        }
        return ResponseEntity.ok(toView(recipes.publish(recipe)));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt principal, @PathVariable Long id) {
        recipes.delete(owned(principal, id));
    }

    /**
     * Scopes every lookup to the caller. A recipe belonging to someone else is
     * reported as missing, not as forbidden — the difference would confirm the
     * id exists.
     */
    private Recipe owned(Jwt principal, Long id) {
        return recipes.find(id, userId(principal))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    private static Long userId(Jwt principal) {
        return Long.valueOf(principal.getSubject());
    }

    private static RecipeView toView(Recipe recipe) {
        return new RecipeView(
                recipe.getId(),
                recipe.getTitle(),
                recipe.getDescription(),
                recipe.getServings(),
                recipe.getLevel(),
                recipe.getStatus().name(),
                recipe.getIngredients().stream()
                        .map(i -> new IngredientView(
                                i.getId(), i.getName(), i.getQuantity().doubleValue(), i.getUnit()))
                        .toList(),
                recipe.getSteps().stream().map(RecipeStep::getText).toList(),
                recipe.getTags());
    }
}
