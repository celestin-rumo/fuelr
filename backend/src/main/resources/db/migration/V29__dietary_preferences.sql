-- What somebody does not eat, said once.
--
-- Since v3.6.0 the planner invents its dishes, and an allergy repeated at
-- every ask is an allergy forgotten once — and the once it is forgotten, the
-- dish is on the plan. Per person, not per household: what one member cannot
-- eat is theirs. Closed lists for the diet and the allergens, for the reason
-- the seasons are closed: "without peanuts" has to be computable, and it is
-- not if it is whatever somebody typed. The free line is for what a list
-- cannot hold, and it only ever reaches a model, quoted.
CREATE TABLE dietary_preferences (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    diet VARCHAR(20) NOT NULL DEFAULT 'NONE',
    dislikes VARCHAR(200),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE dietary_allergens (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    allergen VARCHAR(20) NOT NULL,
    PRIMARY KEY (user_id, allergen)
);
