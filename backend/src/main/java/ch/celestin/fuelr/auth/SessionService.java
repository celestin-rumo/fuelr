package ch.celestin.fuelr.auth;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Service
public class SessionService {

    private final SessionRepository sessions;

    public SessionService(SessionRepository sessions) {
        this.sessions = sessions;
    }

    @Transactional
    public Session open(Long userId, Instant expiresAt, String deviceLabel) {
        return sessions.save(new Session(userId, expiresAt, deviceLabel));
    }

    /**
     * A session that is absent or past its expiry makes the token invalid,
     * whatever its signature says. This is what "revoked on the server" means.
     */
    @Transactional
    public boolean isLive(UUID id) {
        Optional<Session> found = sessions.findById(id);
        if (found.isEmpty()) {
            return false;
        }
        Session session = found.get();
        if (session.getExpiresAt().isBefore(Instant.now())) {
            sessions.delete(session);
            return false;
        }
        session.touch();
        return true;
    }

    @Transactional
    public void close(UUID id) {
        sessions.deleteById(id);
    }

    /** Used when a password changes: every other device has to sign in again. */
    @Transactional
    public int closeOthers(Long userId, UUID keep) {
        return sessions.deleteOtherSessions(userId, keep);
    }

    @Transactional
    public int closeAll(Long userId) {
        return sessions.deleteAllForUser(userId);
    }
}
