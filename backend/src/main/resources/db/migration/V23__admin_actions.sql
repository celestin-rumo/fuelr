-- What an operator did, and to whom.
--
-- Granting somebody a paid tier by hand and deleting an account are the two
-- things in the admin panel that change data belonging to another person. They
-- are also the two that get done in a hurry, from an email, months before
-- anybody asks why. So they are written down.
--
-- This is a trace, not a feature: nothing reads it to decide anything, and the
-- application behaves identically whether it is empty or full. It exists for
-- the question "who gave this account Family, and when?", which has no other
-- answer once the subscription row is the only evidence.
CREATE TABLE admin_actions (
    id BIGSERIAL PRIMARY KEY,

    -- The operator. `SET NULL` rather than cascade: an operator leaving must
    -- not erase what they did, which is the entire point of a trace.
    actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    -- Kept as text as well, because the id stops resolving the day the account
    -- is gone and "someone" is not an audit trail.
    actor_email VARCHAR(255) NOT NULL,

    action VARCHAR(40) NOT NULL,

    -- Who it was done to. No foreign key at all: the row this describes is
    -- usually one that no longer exists — a deletion is the main thing being
    -- recorded here — and a trace that disappears with its subject records
    -- nothing.
    subject_user_id BIGINT,
    subject_email VARCHAR(255) NOT NULL,

    -- Free text for the shape each action needs: the tier granted, what a
    -- deletion carried away. Read by a person, never parsed.
    detail TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_actions_created ON admin_actions (created_at DESC);
CREATE INDEX idx_admin_actions_subject ON admin_actions (subject_user_id);
