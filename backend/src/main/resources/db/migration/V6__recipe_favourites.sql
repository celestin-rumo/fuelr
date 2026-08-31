-- Pinned recipes surface first in the list.
ALTER TABLE recipes ADD COLUMN favorite BOOLEAN NOT NULL DEFAULT false;

-- The list is ordered favourites first, then most recently touched.
CREATE INDEX idx_recipes_user_favorite ON recipes (user_id, favorite DESC, updated_at DESC);
