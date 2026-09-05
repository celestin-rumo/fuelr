package ch.celestin.fuelr.admin;

import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * One door, one role.
 *
 * Every admin endpoint asks this and nothing else. The check was already
 * written once, privately, inside the cost controller; with five sections
 * behind the same door, a second copy is a second place to get it wrong — and
 * the way this goes wrong is that one endpoint answers to everybody.
 *
 * **404, never 403.** A panel that exists only for the operator has no reason
 * to confirm to anybody else that it exists. 403 says "there is something here
 * and you may not have it", which is an answer to a question nobody should be
 * able to ask.
 *
 * The role comes from the verified token, never from anything the caller sent
 * alongside it.
 */
@Component
public class AdminAccess {

    public static final String ROLE = "ADMIN";

    public void require(Jwt principal) {
        if (principal == null || !ROLE.equals(principal.getClaimAsString("role"))) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
    }

    /** The operator's own id, for writing down who did something. */
    public Long actorId(Jwt principal) {
        return Long.valueOf(principal.getSubject());
    }

    public String actorEmail(Jwt principal) {
        return principal.getClaimAsString("email");
    }
}
