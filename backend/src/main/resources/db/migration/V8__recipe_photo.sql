-- Only the path lives in the database; the bytes live on a mounted volume.
-- Keeping binaries out of Postgres keeps dumps small and restores fast.
ALTER TABLE recipes ADD COLUMN photo_path VARCHAR(255);
