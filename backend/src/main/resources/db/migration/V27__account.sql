-- The account page.
--
-- A language that follows the account rather than the browser, and a table
-- for the one thing on that page that must not happen in a single step:
-- changing the address the account is reached at. The new address is stored
-- beside a one-time token and only becomes the login the moment the link in
-- the mail to *that* address is clicked — a typo in a new address must not be
-- able to lock anybody out.
ALTER TABLE users ADD COLUMN locale VARCHAR(5);

CREATE TABLE email_change_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    new_email VARCHAR(255) NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ
);
CREATE INDEX idx_email_change_user ON email_change_tokens (user_id);
