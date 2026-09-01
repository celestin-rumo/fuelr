-- Verification is deliberately not a gate: the account works from the first
-- second, and this column only records whether the address has been proven.
ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMPTZ;

-- Same shape as password_reset_tokens, and separate on purpose: the two have
-- different lifetimes and different consequences, and sharing one table would
-- make a reset link and a verification link interchangeable.
CREATE TABLE email_verification_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ
);

CREATE INDEX idx_email_verification_user ON email_verification_tokens (user_id);
