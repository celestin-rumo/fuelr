-- What an account is entitled to, and the trail of it having been asked for.
--
-- No payment provider is wired yet, and this schema is the shape one will fill
-- in rather than a placeholder for it: an order is created when someone asks
-- for a plan, and a subscription is written when something confirms the order.
-- Today the only thing that can confirm one is the self-activation switch used
-- by development and by the tests; tomorrow it is a webhook, writing the same
-- two rows through the same service.
CREATE TABLE subscriptions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    tier VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    period VARCHAR(20) NOT NULL,
    -- Null means "no end date known", which is what a granted subscription is.
    -- A dated one lapses on its own, without anything having to run.
    current_period_end TIMESTAMPTZ,
    -- Null until a provider is wired. `provider_ref` is its id for the
    -- subscription, so a webhook can find the row it is talking about.
    provider VARCHAR(40),
    provider_ref VARCHAR(120),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE subscription_orders (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tier VARCHAR(20) NOT NULL,
    period VARCHAR(20) NOT NULL,
    -- PENDING until something pays for it. An order that is never paid stays
    -- pending: it is a record of intent, and deleting it would lose the only
    -- evidence that someone tried to buy a plan we could not sell them.
    status VARCHAR(20) NOT NULL,
    provider VARCHAR(40),
    provider_ref VARCHAR(120),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscription_orders_user ON subscription_orders (user_id, created_at DESC);
