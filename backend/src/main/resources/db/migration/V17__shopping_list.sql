-- From the plan to the trolley.
--
-- The list is stored rather than computed on the fly, and that is the whole
-- point: a ticked box is a fact about a person standing in a shop, and it must
-- survive the plan changing under it. Regenerating merges into these rows
-- instead of replacing them.

-- Which aisle a food is found in. It belongs on the reference table because
-- that is already what turns "200 g de lentilles corail" into a known food —
-- one lookup, one place to be wrong.
ALTER TABLE food_nutrition ADD COLUMN aisle VARCHAR(20) NOT NULL DEFAULT 'OTHER';

UPDATE food_nutrition SET aisle = 'PRODUCE'
    WHERE match_key IN ('oignon', 'gingembre', 'épinards', 'tomate', 'ail', 'carotte', 'courgette');
UPDATE food_nutrition SET aisle = 'MEAT_FISH'
    WHERE match_key IN ('poulet', 'saumon', 'boeuf');
UPDATE food_nutrition SET aisle = 'DAIRY'
    WHERE match_key IN ('crème', 'oeuf', 'œuf', 'fromage', 'beurre', 'tofu');
UPDATE food_nutrition SET aisle = 'GROCERY'
    WHERE match_key IN ('lentilles', 'lait de coco', 'curry', 'riz', 'huile',
                        'pois chiches', 'quinoa', 'pâtes');

-- What is already at home. Kept per household, like the plan: the cupboard is
-- shared by whoever cooks from it.
CREATE TABLE pantry_items (
    id BIGSERIAL PRIMARY KEY,
    household_id BIGINT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    -- Lowercased and trimmed. Two spellings of the same thing must meet, or
    -- the cupboard silently stops covering the list.
    match_name VARCHAR(120) NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (household_id, match_name, unit)
);

-- One list per household per week, so last week's ticks are not this week's.
CREATE TABLE shopping_lists (
    id BIGSERIAL PRIMARY KEY,
    household_id BIGINT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (household_id, week_start)
);

CREATE TABLE shopping_items (
    id BIGSERIAL PRIMARY KEY,
    list_id BIGINT NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    match_name VARCHAR(120) NOT NULL,
    -- Null for a free item somebody typed with no amount: "papier toilette".
    quantity NUMERIC(10, 2),
    -- Empty string for the same reason. It is part of the key, so 200 g and
    -- 2 pcs of one thing stay two lines rather than a nonsense sum.
    unit VARCHAR(20) NOT NULL,
    aisle VARCHAR(20) NOT NULL,
    -- PLAN lines are rebuilt from the week; MANUAL lines are never touched by
    -- a regeneration, which is what "conservé à la régénération" means.
    source VARCHAR(10) NOT NULL,
    -- The instant it was ticked, not a boolean: a phone that ticked offline
    -- syncs later, and the later instant has to win over the earlier one.
    checked_at TIMESTAMPTZ,
    -- When the tick last changed, ticks and unticks alike. Without it, an
    -- untick leaves nothing to compare against and a stale tick that arrives
    -- afterwards wins.
    checked_updated_at TIMESTAMPTZ,
    UNIQUE (list_id, match_name, unit)
);

CREATE INDEX idx_shopping_items_list ON shopping_items (list_id);

-- Marking a meal cooked is what takes its ingredients out of the cupboard.
-- Stored so that doing it twice does not empty the shelf twice; it is also
-- where the meal log will hang when that story lands.
ALTER TABLE planned_meals ADD COLUMN cooked_at TIMESTAMPTZ;
