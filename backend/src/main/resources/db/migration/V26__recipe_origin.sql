-- Where a recipe came from.
--
-- Provenance, not a tag. The tags describe the dish — vegetarian, quick,
-- cheap — and are ticked by hand in the editor; a marker that says "a model
-- wrote this" must not be one of them, or somebody can tick it on a recipe
-- they typed and the marker stops meaning anything.
--
-- TYPED is the default because it is what every existing recipe is unless the
-- data says otherwise, and `source_url` is exactly that evidence: it is set by
-- the importer and by nothing else.
ALTER TABLE recipes
    ADD COLUMN origin VARCHAR(16) NOT NULL DEFAULT 'TYPED';

UPDATE recipes SET origin = 'IMPORTED' WHERE source_url IS NOT NULL;

CREATE INDEX idx_recipes_origin ON recipes (user_id, origin);
