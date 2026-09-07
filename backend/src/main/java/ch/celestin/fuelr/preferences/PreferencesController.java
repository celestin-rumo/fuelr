package ch.celestin.fuelr.preferences;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * What somebody does not eat, read and written. Free: an allergy is not a
 * feature, and the screens that respect it are the ones that are paid for.
 */
@RestController
@RequestMapping("/api/preferences")
public class PreferencesController {

    public record View(String diet, List<String> allergens, String dislikes) {
    }

    public record Request(String diet, List<String> allergens, @Size(max = 200) String dislikes) {
    }

    private final DietaryPreferencesRepository preferences;

    public PreferencesController(DietaryPreferencesRepository preferences) {
        this.preferences = preferences;
    }

    @GetMapping
    public View read(@AuthenticationPrincipal Jwt principal) {
        return preferences.findById(Long.valueOf(principal.getSubject()))
                .map(PreferencesController::view)
                .orElse(new View(Diet.NONE.name(), List.of(), null));
    }

    /** Anything outside the two closed lists is dropped rather than refused. */
    @PutMapping
    @Transactional
    public View save(@AuthenticationPrincipal Jwt principal, @Valid @RequestBody Request body) {
        Long userId = Long.valueOf(principal.getSubject());
        DietaryPreferences saved = preferences.findById(userId)
                .orElseGet(() -> new DietaryPreferences(userId));
        saved.setDiet(Diet.parseOrDefault(body.diet() == null ? "NONE" : body.diet()));
        Set<Allergen> allergens = new LinkedHashSet<>();
        for (String one : body.allergens() == null ? List.<String>of() : body.allergens()) {
            Allergen parsed = Allergen.parseOrNull(one);
            if (parsed != null) {
                allergens.add(parsed);
            }
        }
        saved.setAllergens(allergens);
        saved.setDislikes(body.dislikes());
        return view(preferences.save(saved));
    }

    private static View view(DietaryPreferences p) {
        return new View(p.getDiet().name(),
                p.getAllergens().stream().map(Enum::name).filter(Objects::nonNull).toList(),
                p.getDislikes());
    }
}
