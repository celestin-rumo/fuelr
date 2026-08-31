package ch.celestin.fuelr.nutrition;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/nutrition")
public class NutritionController {

    private final NutritionService nutrition;

    public NutritionController(NutritionService nutrition) {
        this.nutrition = nutrition;
    }

    /** Requires a token: the resource server rejects anonymous callers. */
    @PostMapping("/compute")
    public NutritionDtos.Breakdown compute(@Valid @RequestBody NutritionDtos.ComputeRequest body) {
        return nutrition.compute(body.ingredients(), body.servings());
    }
}
