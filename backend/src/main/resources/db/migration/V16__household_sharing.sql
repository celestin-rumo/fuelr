-- A household with more than one account in it.
--
-- `households` already existed with one row per owner; this is what turns it
-- into something several people can be inside. The plan moves onto the
-- household, so "visible to every member" is a property of where the row lives
-- rather than of a query somebody has to remember to write.

-- One shared household at a time. The owner is not a member row — their
-- household is the one they own — so this table holds exactly the people who
-- joined someone else's.
CREATE TABLE household_members (
    id BIGSERIAL PRIMARY KEY,
    household_id BIGINT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_household_members_household ON household_members (household_id);

-- Same shape as the reset and verification links: single use, short-lived, and
-- only the hash is stored, so a leaked backup hands out no working invitations.
CREATE TABLE household_invitations (
    id BIGSERIAL PRIMARY KEY,
    household_id BIGINT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    accepted_by BIGINT REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_household_invitations_household ON household_invitations (household_id);

-- The plan belongs to the household from here on. Everything planned so far
-- belongs to its author's own household, which may not have a row yet.
ALTER TABLE planned_meals ADD COLUMN household_id BIGINT REFERENCES households(id) ON DELETE CASCADE;

INSERT INTO households (owner_user_id)
SELECT DISTINCT pm.user_id FROM planned_meals pm
WHERE NOT EXISTS (SELECT 1 FROM households h WHERE h.owner_user_id = pm.user_id);

UPDATE planned_meals pm SET household_id = h.id
FROM households h WHERE h.owner_user_id = pm.user_id;

ALTER TABLE planned_meals ALTER COLUMN household_id SET NOT NULL;

-- `user_id` stops meaning "whose plan this is" and starts meaning "who put it
-- there" — worth keeping, because the point of a shared plan is knowing that
-- someone already thought about Thursday. It therefore has to survive that
-- person leaving, so it becomes nullable and stops cascading.
ALTER TABLE planned_meals RENAME COLUMN user_id TO created_by;
ALTER TABLE planned_meals DROP CONSTRAINT planned_meals_user_id_fkey;
ALTER TABLE planned_meals ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE planned_meals
    ADD CONSTRAINT planned_meals_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

DROP INDEX idx_planned_meals_user_date;
CREATE INDEX idx_planned_meals_household_date ON planned_meals (household_id, meal_date);
