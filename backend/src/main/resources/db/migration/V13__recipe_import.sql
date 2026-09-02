-- Where a recipe came from, so it can be credited and re-checked.
ALTER TABLE recipes ADD COLUMN source_url VARCHAR(2048);

-- A duration stated by the source. Without one the total is inferred from the
-- step text, as it always was; this only overrides that guess when the page
-- actually said how long it takes.
ALTER TABLE recipes ADD COLUMN total_minutes INTEGER;

-- Comma-separated field names the import could not read with confidence —
-- "servings", "title". The editor marks them; saving the field clears it.
-- Recipe-level because these are single values; ingredients get their own flag
-- below, since a single unreadable line must not tar the whole list.
ALTER TABLE recipes ADD COLUMN unverified VARCHAR(120);

ALTER TABLE recipe_ingredients
    ADD COLUMN needs_review BOOLEAN NOT NULL DEFAULT false;
