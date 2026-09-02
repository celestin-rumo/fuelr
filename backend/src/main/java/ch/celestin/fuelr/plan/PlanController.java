package ch.celestin.fuelr.plan;

import ch.celestin.fuelr.plan.PlanDtos.AddMealRequest;
import ch.celestin.fuelr.plan.PlanDtos.CopyWeekRequest;
import ch.celestin.fuelr.plan.PlanDtos.HouseholdRequest;
import ch.celestin.fuelr.plan.PlanDtos.HouseholdView;
import ch.celestin.fuelr.plan.PlanDtos.PlannedIngredientView;
import ch.celestin.fuelr.plan.PlanDtos.UpdateMealRequest;
import ch.celestin.fuelr.plan.PlanDtos.WeekView;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
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

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/plan")
public class PlanController {

    private final PlanService plan;

    public PlanController(PlanService plan) {
        this.plan = plan;
    }

    /**
     * The week containing {@code week}, or the current one. Any day inside a
     * week names it, so the client never has to know where a week starts.
     */
    @GetMapping
    public WeekView week(
            @AuthenticationPrincipal Jwt principal,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate week) {
        return plan.week(userId(principal), week != null ? week : LocalDate.now());
    }

    /** What the week needs bought, scaled to each meal's servings. */
    @GetMapping("/ingredients")
    public List<PlannedIngredientView> ingredients(
            @AuthenticationPrincipal Jwt principal,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate week) {
        return plan.ingredients(userId(principal), week != null ? week : LocalDate.now());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PlanDtos.PlannedMealView add(
            @AuthenticationPrincipal Jwt principal,
            @Valid @RequestBody AddMealRequest body) {
        try {
            PlannedMeal meal = plan.add(userId(principal), body);
            return mealOf(principal, meal.getId(), meal.getDate());
        } catch (PlanService.UnknownRecipeException e) {
            // A recipe that is not the caller's is reported as missing, not as
            // forbidden — the difference would confirm the id exists.
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, e.getMessage());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    /** Move, re-portion, or both. Never a re-entry of the recipe. */
    @PutMapping("/{id}")
    public PlanDtos.PlannedMealView update(
            @AuthenticationPrincipal Jwt principal,
            @PathVariable Long id,
            @Valid @RequestBody UpdateMealRequest body) {
        PlannedMeal meal = owned(principal, id);
        try {
            PlannedMeal saved = plan.update(meal, body);
            return mealOf(principal, saved.getId(), saved.getDate());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@AuthenticationPrincipal Jwt principal, @PathVariable Long id) {
        plan.remove(owned(principal, id));
    }

    /**
     * Says a meal was actually cooked, which is what takes its ingredients out
     * of the cupboard. Saying it twice changes nothing.
     */
    @PostMapping("/{id}/cooked")
    public PlanDtos.PlannedMealView cooked(
            @AuthenticationPrincipal Jwt principal, @PathVariable Long id) {
        PlannedMeal meal = owned(principal, id);
        plan.markCooked(meal);
        return mealOf(principal, meal.getId(), meal.getDate());
    }

    /**
     * Takes the mark back. Nothing goes back into the cupboard — nobody knows
     * whether the food was un-eaten.
     */
    @DeleteMapping("/{id}/cooked")
    public PlanDtos.PlannedMealView notCooked(
            @AuthenticationPrincipal Jwt principal, @PathVariable Long id) {
        PlannedMeal meal = owned(principal, id);
        plan.markNotCooked(meal);
        return mealOf(principal, meal.getId(), meal.getDate());
    }

    /**
     * Copies one week onto another. 409 when the target is not empty and the
     * caller has not said to replace it — the screen turns that into a
     * question rather than into a loss.
     */
    @PostMapping("/copy")
    public WeekView copy(
            @AuthenticationPrincipal Jwt principal,
            @Valid @RequestBody CopyWeekRequest body) {
        try {
            return plan.copyWeek(userId(principal), body);
        } catch (PlanService.WeekNotEmptyException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
        }
    }

    @GetMapping("/household")
    public HouseholdView household(@AuthenticationPrincipal Jwt principal) {
        return new HouseholdView(plan.householdSize(userId(principal)));
    }

    @PutMapping("/household")
    public HouseholdView setHousehold(
            @AuthenticationPrincipal Jwt principal,
            @Valid @RequestBody HouseholdRequest body) {
        return new HouseholdView(plan.setHouseholdSize(userId(principal), body.size()));
    }

    /**
     * Reads one meal back out of its own week, so a single response is built by
     * the same code that builds the grid — one place decides what a planned
     * meal looks like.
     */
    private PlanDtos.PlannedMealView mealOf(Jwt principal, Long id, LocalDate date) {
        return plan.week(userId(principal), date).meals().stream()
                .filter(m -> m.id().equals(id))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    private PlannedMeal owned(Jwt principal, Long id) {
        return plan.find(id, userId(principal))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    private static Long userId(Jwt principal) {
        return Long.valueOf(principal.getSubject());
    }
}
