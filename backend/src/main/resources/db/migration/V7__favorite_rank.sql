-- Manual ordering among pinned recipes. Only favourites carry a rank; an
-- unpinned recipe keeps NULL and falls back to the updated_at ordering.
ALTER TABLE recipes ADD COLUMN favorite_rank INTEGER;

-- Existing favourites get their current implicit order made explicit, so
-- turning the feature on does not reshuffle anyone's list.
WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC) - 1 AS rank
    FROM recipes WHERE favorite
)
UPDATE recipes SET favorite_rank = ranked.rank
FROM ranked WHERE recipes.id = ranked.id;

CREATE INDEX idx_recipes_favorite_rank ON recipes (user_id, favorite_rank);
