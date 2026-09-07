package ch.celestin.fuelr.plan;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

/**
 * One week, read as one afternoon's work.
 *
 * A read of what is already planned: nothing here writes, and nothing here is
 * paid for — whether two dishes share a base is arithmetic over lines the
 * library already holds.
 */
@RestController
@RequestMapping("/api/plan/prep")
public class PrepController {

    private final PrepService prep;

    public PrepController(PrepService prep) {
        this.prep = prep;
    }

    @GetMapping
    public PrepService.Session session(@AuthenticationPrincipal Jwt principal,
                                       @RequestParam(required = false) LocalDate week) {
        return prep.forWeek(Long.valueOf(principal.getSubject()),
                week != null ? week : LocalDate.now());
    }
}
