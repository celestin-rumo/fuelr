package ch.celestin.fuelr.weight;

import ch.celestin.fuelr.profile.Profile;
import ch.celestin.fuelr.profile.ProfileRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;

/**
 * Weigh-ins, and nothing said about them.
 *
 * A curve of weight is the field where an application most easily starts to
 * judge. This one stores a figure and its date, hands them back, and stops:
 * no streak, no verdict, no congratulation. Free, because it is the person's
 * own number — what is paid for is measuring a week against a target, and
 * that is elsewhere.
 *
 * **A weigh-in is the profile's weight.** There is one place to say what you
 * weigh, and it is here; `profiles.weight_kg` follows the latest weigh-in, so
 * the journal's target is computed on a weight somebody actually has rather
 * than the one typed the day they signed up. Only the latest: writing last
 * month's weigh-in in does not roll the profile back.
 */
@RestController
@RequestMapping("/api/weight")
public class WeightController {

    public record Entry(Long id, LocalDate weighedOn, double weightKg) {
    }

    public record View(
            List<Entry> entries,
            /** The most recent weigh-in of all, not only of the period asked for. */
            Entry latest,
            /** What the target is computed from today. Null without a profile. */
            Double profileWeightKg) {
    }

    public record Record(
            @NotNull LocalDate weighedOn,
            @NotNull @DecimalMin("30") @DecimalMax("300") Double weightKg) {
    }

    private final WeightEntryRepository entries;
    private final ProfileRepository profiles;

    public WeightController(WeightEntryRepository entries, ProfileRepository profiles) {
        this.entries = entries;
        this.profiles = profiles;
    }

    @GetMapping
    public View list(@AuthenticationPrincipal Jwt principal,
                     @RequestParam(required = false) LocalDate from,
                     @RequestParam(required = false) LocalDate to) {
        Long userId = userId(principal);
        LocalDate end = to != null ? to : LocalDate.now();
        // Eight weeks by default: long enough to see a direction, short enough
        // to read on a phone.
        LocalDate start = from != null ? from : end.minusWeeks(8);
        List<Entry> found = entries
                .findByUserIdAndWeighedOnBetweenOrderByWeighedOnAsc(userId, start, end)
                .stream().map(WeightController::view).toList();
        Entry latest = entries.findFirstByUserIdOrderByWeighedOnDesc(userId)
                .map(WeightController::view).orElse(null);
        Double profileWeight = profiles.findByUserId(userId)
                .map(Profile::toInput).map(input -> input.weightKg()).orElse(null);
        return new View(found, latest, profileWeight);
    }

    /** One figure a day: weighing twice replaces rather than appends. */
    @PostMapping
    @Transactional
    public Entry record(@AuthenticationPrincipal Jwt principal, @Valid @RequestBody Record body) {
        Long userId = userId(principal);
        if (body.weighedOn().isAfter(LocalDate.now().plusDays(1))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "future");
        }
        BigDecimal kg = BigDecimal.valueOf(body.weightKg()).setScale(1, RoundingMode.HALF_UP);
        WeightEntry entry = entries.findByUserIdAndWeighedOn(userId, body.weighedOn())
                .map(existing -> {
                    existing.setWeightKg(kg);
                    return existing;
                })
                .orElseGet(() -> new WeightEntry(userId, body.weighedOn(), kg));
        WeightEntry saved = entries.save(entry);
        boolean latest = entries.findFirstByUserIdOrderByWeighedOnDesc(userId)
                .map(top -> top.getId().equals(saved.getId())).orElse(true);
        if (latest) {
            profiles.findByUserId(userId).ifPresent(profile -> {
                var input = profile.toInput();
                profile.apply(new ch.celestin.fuelr.profile.ProfileDtos.ProfileInput(
                        input.birthDate(), input.sex(), input.heightCm(), kg.doubleValue(),
                        input.activity(), input.goal()));
                profiles.save(profile);
            });
        }
        return view(saved);
    }

    /**
     * No confirmation and no soft delete: a weigh-in is frequent and exactly
     * recreatable, so the screen offers undo instead of asking first.
     */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@AuthenticationPrincipal Jwt principal, @PathVariable Long id) {
        WeightEntry entry = entries.findByIdAndUserId(id, userId(principal))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        entries.delete(entry);
    }

    private static Entry view(WeightEntry entry) {
        return new Entry(entry.getId(), entry.getWeighedOn(), entry.getWeightKg().doubleValue());
    }

    private static Long userId(Jwt principal) {
        return Long.valueOf(principal.getSubject());
    }
}
