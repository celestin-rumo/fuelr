-- The week plan: which recipe is cooked which day, in which slot, for how many.
--
-- A planned meal points at the live recipe on purpose. It is an intention for
-- a day that has not happened yet, so a recipe corrected on Tuesday should be
-- the one cooked on Thursday. The meal *log* is the exact opposite and copies
-- its values at the moment of logging — see CLAUDE.md. That is also why
-- deleting a recipe takes its planned meals with it: nothing was cooked, so
-- there is no history to protect.
CREATE TABLE households (
    id BIGSERIAL PRIMARY KEY,
    -- One household per account for now. The Famille story adds the members
    -- table beside this one and moves planned_meals onto household_id; until
    -- then the owner is the only member and the plan stays on the user.
    owner_user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    size INTEGER NOT NULL DEFAULT 2,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE planned_meals (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipe_id BIGINT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    meal_date DATE NOT NULL,
    slot VARCHAR(20) NOT NULL,
    -- Order within one slot: two dishes on the same evening keep the order
    -- they were dropped in.
    position INTEGER NOT NULL DEFAULT 0,
    -- Stored, never derived from the recipe. Changing a recipe's servings must
    -- not silently rewrite the quantities the shopping list was built from.
    servings INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The week view reads one user over a seven-day range, and nothing else.
CREATE INDEX idx_planned_meals_user_date ON planned_meals (user_id, meal_date);
