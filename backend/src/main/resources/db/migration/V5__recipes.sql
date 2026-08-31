-- Recipes belong to an account and start life as a DRAFT: the editor creates
-- one before anything has been typed, so every column below except the owner
-- has to tolerate being empty.
CREATE TABLE recipes (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    description TEXT,
    servings INTEGER NOT NULL DEFAULT 4,
    level VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recipes_user ON recipes (user_id, updated_at DESC);

-- `position` keeps the author's order; rows are replaced wholesale on save,
-- so there is no partial-update ordering to reconcile.
CREATE TABLE recipe_ingredients (
    id BIGSERIAL PRIMARY KEY,
    recipe_id BIGINT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL,
    unit VARCHAR(20) NOT NULL
);

CREATE INDEX idx_recipe_ingredients_recipe ON recipe_ingredients (recipe_id, position);

CREATE TABLE recipe_steps (
    id BIGSERIAL PRIMARY KEY,
    recipe_id BIGINT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    text TEXT NOT NULL
);

CREATE INDEX idx_recipe_steps_recipe ON recipe_steps (recipe_id, position);

CREATE TABLE recipe_tags (
    recipe_id BIGINT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    tag VARCHAR(50) NOT NULL,
    PRIMARY KEY (recipe_id, tag)
);
