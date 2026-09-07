-- One row per weigh-in.
--
-- `profiles.weight_kg` was a single value written at registration and never
-- read again; six months later the journal's target was computed on a weight
-- nobody had. This is the history. The profile keeps its own figure on
-- purpose: it is the one the target is computed from, and it only moves when
-- somebody says so — a weigh-in *proposes* a new target, it never applies one.
CREATE TABLE weight_entries (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    weighed_on DATE NOT NULL,
    weight_kg NUMERIC(5, 1) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- One figure a day. Weighing twice replaces, it does not append.
    CONSTRAINT uq_weight_user_day UNIQUE (user_id, weighed_on)
);
CREATE INDEX idx_weight_user_date ON weight_entries (user_id, weighed_on);
