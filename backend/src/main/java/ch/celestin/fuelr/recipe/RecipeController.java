package ch.celestin.fuelr.recipe;

import ch.celestin.fuelr.media.MediaStorage;
import ch.celestin.fuelr.nutrition.NutritionDtos;
import ch.celestin.fuelr.nutrition.NutritionService;
import ch.celestin.fuelr.recipe.RecipeDtos.ImportRequest;
import ch.celestin.fuelr.recipe.importer.RecipeImportService;
import ch.celestin.fuelr.recipe.importer.SafePageFetcher;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/recipes")
public class RecipeController {

    private final RecipeService recipes;
    private final NutritionService nutrition;
    private final MediaStorage media;
    private final RecipeImportService recipeImport;

    public RecipeController(
            RecipeService recipes, NutritionService nutrition, MediaStorage media,
            RecipeImportService recipeImport) {
        this.recipes = recipes;
        this.nutrition = nutrition;
        this.media = media;
        this.recipeImport = recipeImport;
    }

    /** Uploading replaces whatever was there; the old file is removed. */
    @PostMapping("/{id}/photo")
    public RecipeView uploadPhoto(
            @AuthenticationPrincipal Jwt principal,
            @PathVariable Long id,
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        Recipe recipe = owned(principal, id);
        String stored;
        try {
            stored = media.store(file);
        } catch (MediaStorage.UnsupportedMediaException e) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "unsupported_format");
        } catch (MediaStorage.FileTooLargeException e) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "file_too_large");
        }
        String previous = recipe.getPhotoPath();
        recipe.setPhotoPath(stored);
        RecipeView view = toView(recipes.savePhoto(recipe));
        media.delete(previous);
        return view;
    }

    @DeleteMapping("/{id}/photo")
    public RecipeView removePhoto(
            @AuthenticationPrincipal Jwt principal, @PathVariable Long id) {
        Recipe recipe = owned(principal, id);
        String previous = recipe.getPhotoPath();
        recipe.setPhotoPath(null);
        RecipeView view = toView(recipes.savePhoto(recipe));
        media.delete(previous);
        return view;
    }

    @GetMapping("/{id}/photo")
    public ResponseEntity<org.springframework.core.io.Resource> photo(
            @AuthenticationPrincipal Jwt principal, @PathVariable Long id) {
        Recipe recipe = owned(principal, id);
        if (recipe.getPhotoPath() == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        var resource = new org.springframework.core.io.FileSystemResource(
                media.resolve(recipe.getPhotoPath()));
        if (!resource.exists()) {
            // The row points at a file the volume no longer holds.
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "file_missing");
        }
        return ResponseEntity.ok()
                .header("Content-Type", MediaStorage.contentTypeOf(recipe.getPhotoPath()))
                .header("Cache-Control", "private, max-age=60")
                .body(resource);
    }

    /** Opening the editor creates the draft; there is no form to fill first. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RecipeView createDraft(@AuthenticationPrincipal Jwt principal) {
        return toView(recipes.createDraft(userId(principal)));
    }

    /**
     * Imports from a link, and always lands in the editor as a draft.
     *
     * The two failure modes are told apart on purpose: a page we could not
     * reach is 502, a page we reached but could not read is 422. The screen
     * says something different for each, and offers manual entry either way —
     * a failed import must not be a dead end.
     */
    @PostMapping("/import")
    @ResponseStatus(HttpStatus.CREATED)
    public RecipeView importFromUrl(
            @AuthenticationPrincipal Jwt principal,
            @Valid @RequestBody ImportRequest body) {
        try {
            return toView(recipeImport.importFrom(userId(principal), body.url()));
        } catch (SafePageFetcher.UnreadableSourceException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, e.getMessage());
        } catch (RecipeImportService.NothingToImportException e) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, e.getMessage());
        }
    }

    @GetMapping
    public List<RecipeSummary> list(
            @AuthenticationPrincipal Jwt principal,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) java.util.Set<String> tags) {
        return recipes.search(userId(principal), q, tags).stream()
                .map(this::toSummary).toList();
    }

    /** Pinning is a single call, so the grid can flip without a reload. */
    @PutMapping("/{id}/favorite")
    public RecipeSummary setFavorite(
            @AuthenticationPrincipal Jwt principal,
            @PathVariable Long id,
            @RequestBody FavoriteRequest body) {
        return toSummary(recipes.setFavorite(owned(principal, id), body.favorite()));
    }

    public record FavoriteRequest(boolean favorite) {
    }

    /** Moves a pinned recipe one position up or down. */
    @PutMapping("/{id}/favorite/move")
    public List<RecipeSummary> moveFavorite(
            @AuthenticationPrincipal Jwt principal,
            @PathVariable Long id,
            @RequestBody MoveRequest body) {
        Recipe recipe = owned(principal, id);
        try {
            recipes.moveFavorite(recipe, body.direction() < 0 ? -1 : 1);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "not_a_favorite");
        }
        return list(principal, null, null);
    }

    public record MoveRequest(int direction) {
    }

    /** A copy the author edits freely; nothing links it back to the original. */
    @PostMapping("/{id}/duplicate")
    @ResponseStatus(HttpStatus.CREATED)
    public RecipeView duplicate(
            @AuthenticationPrincipal Jwt principal,
            @PathVariable Long id,
            @RequestParam(defaultValue = " (copie)") String suffix) {
        return toView(recipes.duplicate(owned(principal, id), suffix));
    }

    /**
     * Every recipe of the caller, as plain JSON. No pagination and no filter:
     * this exists so the data can be taken elsewhere, so it has to be whole.
     */
    @GetMapping("/export")
    public ResponseEntity<List<RecipeView>> export(@AuthenticationPrincipal Jwt principal) {
        List<RecipeView> all = recipes.list(userId(principal)).stream()
                .map(RecipeController::toView).toList();
        return ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=\"fuelr-recettes.json\"")
                .body(all);
    }

    private RecipeSummary toSummary(Recipe recipe) {
        // A recipe with no ingredients has no figures to show — null rather
        // than a misleading zero.
        NutritionDtos.Breakdown breakdown = recipe.getIngredients().isEmpty() ? null
                : nutrition.compute(
                        recipe.getIngredients().stream()
                                .map(i -> new NutritionDtos.IngredientInput(
                                        i.getName(), i.getQuantity().doubleValue(), i.getUnit()))
                                .toList(),
                        recipe.getServings());

        return new RecipeSummary(
                recipe.getId(), recipe.getTitle(), recipe.getStatus().name(),
                recipe.getServings(), recipe.getIngredients().size(),
                recipe.getSteps().size(), recipe.isFavorite(),
                recipe.getPhotoPath() != null,
                RecipeService.minutesFor(recipe),
                breakdown == null ? null : breakdown.perServing().kcal(),
                breakdown == null ? null : breakdown.perServing().proteinG(),
                breakdown == null ? null : breakdown.perServing().carbsG(),
                breakdown == null ? null : breakdown.perServing().fatG(),
                breakdown != null && breakdown.containsEstimates());
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
                recipe.getPhotoPath() != null,
                recipe.getIngredients().stream()
                        .map(i -> new IngredientView(
                                i.getId(), i.getName(), i.getQuantity().doubleValue(),
                                i.getUnit(), i.isNeedsReview()))
                        .toList(),
                recipe.getSteps().stream().map(RecipeStep::getText).toList(),
                recipe.getTags(),
                recipe.getSourceUrl(),
                recipe.getTotalMinutes(),
                recipe.getUnverified() == null || recipe.getUnverified().isBlank()
                        ? java.util.Set.of()
                        : new java.util.LinkedHashSet<>(
                                java.util.List.of(recipe.getUnverified().split(","))));
    }
}
