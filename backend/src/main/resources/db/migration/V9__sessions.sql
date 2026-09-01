-- One row per issued token, so a session can be closed on the server rather
-- than only forgotten by the browser.
--
-- The row holds no token material: the JWT carries the session id as a `sid`
-- claim, and its signature already proves the claim is genuine. Storing a hash
-- of the token as well would add a second secret to protect for no gain.
CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- What the person will recognise in a list of active sessions.
    device_label VARCHAR(255)
);

CREATE INDEX idx_sessions_user ON sessions (user_id, last_used_at DESC);

-- Progressive delay after repeated failures. In the database rather than in
-- memory: a restart would clear an in-memory counter, and two instances would
-- not share it.
ALTER TABLE users ADD COLUMN failed_logins INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until TIMESTAMPTZ;
