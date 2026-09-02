package ch.celestin.fuelr.nutrition;

import ch.celestin.fuelr.subscription.Entitlements;
import ch.celestin.fuelr.subscription.Feature;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/nutrition")
public class NutritionController {

    private final NutritionService nutrition;
    private final Entitlements entitlements;

    public NutritionController(NutritionService nutrition, Entitlements entitlements) {
        this.nutrition = nutrition;
        this.entitlements = entitlements;
    }

    /** Requires a token: the resource server rejects anonymous callers. */
    @PostMapping("/compute")
    public NutritionDtos.Breakdown compute(@Valid @RequestBody NutritionDtos.ComputeRequest body) {
        return nutrition.compute(body.ingredients(), body.servings());
    }

    /**
     * The paid detail: macros past the four headline figures, and the vitamins
     * and minerals the source measured. Energy stays free — it is what lets
     * somebody place a dish at a glance, and taking it away would make the
     * free plan worse rather than the paid one better.
     */
    @PostMapping("/detail")
    public NutritionDtos.Detail detail(
            @AuthenticationPrincipal Jwt principal,
            @Valid @RequestBody NutritionDtos.ComputeRequest body) {
        entitlements.require(Long.valueOf(principal.getSubject()), Feature.NUTRITION_DETAIL);
        return nutrition.detail(body.ingredients(), body.servings());
    }
}
