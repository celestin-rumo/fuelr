-- Real accounts, not just the bootstrapped admin: a display name, and USER as
-- the default role now that people can register themselves.
ALTER TABLE users ADD COLUMN name VARCHAR(255);
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'USER';

-- Lookups by email happen on every login; the UNIQUE constraint already
-- indexes it, so nothing more is needed here.
