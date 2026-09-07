-- One archive per request, and the one-time link that fetches it.
--
-- The archive is built in the background and lives on disk for a day at
-- most; the row is what remembers it exists, so a cleanup can find what a
-- download never took and a deleted account can cancel what it asked for.
CREATE TABLE data_exports (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    path VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ready_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    downloaded_at TIMESTAMPTZ
);
CREATE INDEX idx_data_exports_user ON data_exports (user_id);
