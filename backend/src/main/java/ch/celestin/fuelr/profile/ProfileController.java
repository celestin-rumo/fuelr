package ch.celestin.fuelr.profile;

import ch.celestin.fuelr.profile.ProfileDtos.ProfileInput;
import ch.celestin.fuelr.profile.ProfileDtos.ProfileResponse;
import ch.celestin.fuelr.profile.ProfileDtos.Targets;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class ProfileController {

    private final ProfileRepository profiles;
    private final NutritionTargetService targets;

    public ProfileController(ProfileRepository profiles, NutritionTargetService targets) {
        this.profiles = profiles;
        this.targets = targets;
    }

    /**
     * The preview, and the only public endpoint here.
     *
     * Someone weighing up the app sees their own numbers before being asked
     * for an account. Nothing is stored, so there is nothing to protect: this
     * is arithmetic on figures the caller already typed.
     */
    @PostMapping("/nutrition/target")
    public Targets preview(@Valid @RequestBody ProfileInput body) {
        return targets.compute(body);
    }

    @GetMapping("/profile")
    public ProfileResponse read(@AuthenticationPrincipal Jwt principal) {
        Profile profile = profiles.findByUserId(Long.valueOf(principal.getSubject()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return new ProfileResponse(profile.toInput(), targets.compute(profile.toInput()));
    }

    /** Creates or replaces the profile: there is only ever one per account. */
    @PutMapping("/profile")
    public ProfileResponse save(
            @AuthenticationPrincipal Jwt principal, @Valid @RequestBody ProfileInput body) {
        Long userId = Long.valueOf(principal.getSubject());
        Profile profile = profiles.findByUserId(userId)
                .map(existing -> {
                    existing.apply(body);
                    return existing;
                })
                .orElseGet(() -> new Profile(userId, body));
        profiles.save(profile);
        return new ProfileResponse(body, targets.compute(body));
    }
}
