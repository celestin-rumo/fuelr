-- One profile per account. Everything Mifflin-St Jeor needs, plus the goal
-- that shifts the result up or down.
CREATE TABLE profiles (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    age INTEGER NOT NULL,
    sex VARCHAR(10) NOT NULL,
    height_cm INTEGER NOT NULL,
    weight_kg NUMERIC(5, 1) NOT NULL,
    activity VARCHAR(20) NOT NULL,
    goal VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
