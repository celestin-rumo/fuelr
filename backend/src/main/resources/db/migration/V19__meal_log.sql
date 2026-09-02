-- What was actually eaten, and what somebody is aiming for.
--
-- A logged meal copies its values and never references the recipe. Recipes get
-- corrected after they have been cooked — a typo in the quantities, a better
-- measurement — and a log that pointed at the live recipe would rewrite
-- somebody's nutritional history every time. The recipe id is kept for the
-- record, without a foreign key, so deleting a recipe leaves the history
-- intact and merely unlinked.
CREATE TABLE meal_log (
    id BIGSERIAL PRIMARY KEY,
    -- Per person, not per household: what one member ate is not what the
    -- others ate, and the profile it is measured against is personal.
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    meal_date DATE NOT NULL,
    slot VARCHAR(20) NOT NULL,
    servings NUMERIC(6, 2) NOT NULL DEFAULT 1,
    -- The figures as they were at the moment of eating. Copied, never joined.
    kcal NUMERIC(8, 2) NOT NULL,
    protein_g NUMERIC(8, 2) NOT NULL,
    carbs_g NUMERIC(8, 2) NOT NULL,
    fat_g NUMERIC(8, 2) NOT NULL,
    -- At least one ingredient fell through to the flat guess. Carried into the
    -- log so a total can say how sure of itself it is, months later.
    estimated BOOLEAN NOT NULL DEFAULT false,
    -- PLAN, RECIPE or FREE. Where it came from, for the record only.
    source VARCHAR(20) NOT NULL,
    recipe_id BIGINT,
    planned_meal_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_meal_log_user_date ON meal_log (user_id, meal_date);

-- A planned meal is logged once, however many times it is marked cooked.
CREATE UNIQUE INDEX idx_meal_log_planned ON meal_log (user_id, planned_meal_id)
    WHERE planned_meal_id IS NOT NULL;

-- What somebody is aiming for. Absent means "whatever the profile computes",
-- which is the honest default: a target nobody chose is a suggestion.
CREATE TABLE nutrition_targets (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    kcal INTEGER NOT NULL,
    protein_g INTEGER NOT NULL,
    carbs_g INTEGER NOT NULL,
    fat_g INTEGER NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
