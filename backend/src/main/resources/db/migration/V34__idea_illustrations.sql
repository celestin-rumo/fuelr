-- A picture drawn for a dish that is only proposed, keyed by whose it is and
-- the dish's normalised title, because an idea has no id. Consumed when the
-- dish becomes a draft — the file becomes the recipe's photo — and swept
-- after a week otherwise: a proposal nobody kept is a proposal nobody kept.
CREATE TABLE idea_illustrations (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title_key  VARCHAR(64)  NOT NULL,
    title      TEXT         NOT NULL,
    photo_path VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (user_id, title_key)
);
