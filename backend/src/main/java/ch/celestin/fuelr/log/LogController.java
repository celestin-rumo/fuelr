package ch.celestin.fuelr.log;

import ch.celestin.fuelr.log.LogDtos.HistoryView;
import ch.celestin.fuelr.log.LogDtos.LogRequest;
import ch.celestin.fuelr.log.LogDtos.TargetRequest;
import ch.celestin.fuelr.log.LogDtos.Targets;
import ch.celestin.fuelr.log.LogDtos.WeekView;
import ch.celestin.fuelr.subscription.Entitlements;
import ch.celestin.fuelr.subscription.Feature;
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

@RestController
@RequestMapping("/api/log")
public class LogController {

    private final LogService log;
    private final Entitlements entitlements;

    public LogController(LogService log, Entitlements entitlements) {
        this.log = log;
        this.entitlements = entitlements;
    }

    /**
     * The week as eaten. Free: writing a diary and reading it back is the
     * whole of the free promise. What costs money is the target beside it and
     * the findings under it, and the response says which of those it carries.
     */
    @GetMapping
    public WeekView week(
            @AuthenticationPrincipal Jwt principal,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate week) {
        return log.week(userId(principal), week != null ? week : LocalDate.now());
    }

    /**
     * Day totals over a range. The free plan is clamped to a sliding window
     * rather than refused: the answer is smaller, not an error, and the rows
     * outside it are still there for the day the plan changes.
     */
    @GetMapping("/history")
    public HistoryView history(
            @AuthenticationPrincipal Jwt principal,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return log.history(userId(principal), from, to);
    }

    /** A recipe eaten, or a meal that never was one. Both are free. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public LogDtos.EntryView add(
            @AuthenticationPrincipal Jwt principal,
            @Valid @RequestBody LogRequest body) {
        try {
            MealLogEntry entry = log.log(userId(principal), body);
            return new LogDtos.EntryView(
                    entry.getId(), entry.getDate(), entry.getSlot(), entry.getTitle(),
                    entry.getServings(), entry.getKcal(), entry.getProteinG(),
                    entry.getCarbsG(), entry.getFatG(), entry.isEstimated(),
                    entry.getSource().name(), entry.getRecipeId());
        } catch (LogService.UnknownRecipeException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, e.getMessage());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@AuthenticationPrincipal Jwt principal, @PathVariable Long id) {
        if (!log.remove(userId(principal), id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
    }

    /** Setting a target is part of tracking, and tracking is paid for. */
    @PutMapping("/targets")
    public Targets setTargets(
            @AuthenticationPrincipal Jwt principal,
            @Valid @RequestBody TargetRequest body) {
        Long userId = userId(principal);
        entitlements.require(userId, Feature.NUTRITION_TRACKING);
        return log.setTargets(userId, body);
    }

    private static Long userId(Jwt principal) {
        return Long.valueOf(principal.getSubject());
    }
}
