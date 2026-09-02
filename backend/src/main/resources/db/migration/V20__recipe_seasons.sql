-- Which seasons a recipe belongs to.
--
-- A closed domain of four values rather than a free-text tag: that is what
-- lets "what is in season now" be derived from the date instead of guessed
-- from whatever the author happened to type. A recipe carries zero, one or
-- several — a squash soup is autumn *and* winter, and most recipes are of no
-- season at all, which is why this is a table rather than a column.
CREATE TABLE recipe_seasons (
    recipe_id BIGINT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    season VARCHAR(10) NOT NULL,
    PRIMARY KEY (recipe_id, season)
);

CREATE INDEX idx_recipe_seasons_season ON recipe_seasons (season);
