-- Recommending Fuelr, and the one email somebody may ask for.
--
-- `referral_code` is minted the first time the account looks at its link and
-- never changes. `referred_by` is written once, at registration, from a code
-- carried in a cookie — and it is read by nothing yet: no plan is paid for,
-- so there is nothing to thank anybody with, and promising it would be the
-- pricing page in reverse. It survives the referrer leaving (SET NULL).
--
-- The reminder is off by default (day NULL). A day and an hour, and a token
-- that stops it from the mail itself, with no session.
ALTER TABLE users ADD COLUMN referral_code VARCHAR(12) UNIQUE;
ALTER TABLE users ADD COLUMN referred_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN reminder_day SMALLINT;
ALTER TABLE users ADD COLUMN reminder_hour SMALLINT;
ALTER TABLE users ADD COLUMN reminder_token VARCHAR(64) UNIQUE;
CREATE INDEX idx_users_referred_by ON users (referred_by) WHERE referred_by IS NOT NULL;
CREATE INDEX idx_users_reminder ON users (reminder_day, reminder_hour) WHERE reminder_day IS NOT NULL;
