-- Which cuisine a recipe belongs to.
--
-- A column and not a join table, unlike `recipe_seasons`: a dish is of at most
-- one cuisine, and a join table would permit several. The story's own
-- criterion is "zero or one", and a column is the shape that says so — a
-- constraint the database enforces beats one every writer has to remember.
--
-- Closed like `Season` and for the same reason: "show me the Italian ones" has
-- to be computable, and it is not if the value is whatever somebody typed. The
-- application's own history makes the point — a recipe tagged "soupe" is a
-- recipe no filter will ever find.
--
-- NULL is the normal case, not an omission. A gratin of courgettes is from
-- nowhere, and most recipes are.
ALTER TABLE recipes ADD COLUMN cuisine VARCHAR(20);

CREATE INDEX idx_recipes_cuisine ON recipes (user_id, cuisine) WHERE cuisine IS NOT NULL;
