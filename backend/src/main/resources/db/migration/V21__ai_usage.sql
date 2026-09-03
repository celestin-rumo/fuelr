-- What each assisted read actually cost us.
--
-- One row per call, never a running total: a total cannot be re-derived when a
-- price changes or a figure is doubted, and this table is the only evidence of
-- what a subscriber costs. The month is stored alongside the instant so the
-- budget is one indexed sum rather than a range scan.
--
-- The cost is in micro-dollars — the provider bills in dollars per million
-- tokens, and an integer is the only honest way to hold a figure that small.
CREATE TABLE ai_usage (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- The first day of the month the call belongs to.
    period        DATE        NOT NULL,
    operation     VARCHAR(40) NOT NULL,
    provider      VARCHAR(40) NOT NULL,
    input_tokens  BIGINT      NOT NULL,
    output_tokens BIGINT      NOT NULL,
    cost_micros   BIGINT      NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_usage_user_period ON ai_usage (user_id, period);
