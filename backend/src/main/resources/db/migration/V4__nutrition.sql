-- Reference food table. Values are per 100 g / 100 ml, as
-- [kcal, protein, carbohydrate, fat] in grams.
--
-- This lives in the database rather than in the client so the web app and the
-- future React Native app compute identical figures from identical data.
CREATE TABLE food_nutrition (
    id BIGSERIAL PRIMARY KEY,
    -- Lowercase token matched against an ingredient name by substring.
    match_key VARCHAR(100) NOT NULL UNIQUE,
    kcal NUMERIC(8, 2) NOT NULL,
    protein_g NUMERIC(8, 2) NOT NULL,
    carbs_g NUMERIC(8, 2) NOT NULL,
    fat_g NUMERIC(8, 2) NOT NULL
);

INSERT INTO food_nutrition (match_key, kcal, protein_g, carbs_g, fat_g) VALUES
    ('lentilles',    350, 24, 60,  1),
    ('lait de coco', 200,  2,  6, 19),
    ('oignon',        40,  1,  9,  0),
    ('gingembre',     80,  2, 18,  1),
    ('curry',         45,  1,  4,  3),
    ('épinards',      23,  3,  2,  0),
    ('poulet',       165, 31,  0,  4),
    ('riz',          350,  7, 78,  1),
    ('tomate',        18,  1,  4,  0),
    ('huile',        880,  0,  0, 100),
    ('ail',          150,  6, 33,  1),
    ('crème',        290,  2,  3, 30),
    ('oeuf',          70,  6,  1,  5),
    ('œuf',           70,  6,  1,  5),
    ('pois chiches', 360, 19, 61,  6),
    ('quinoa',       368, 14, 64,  6),
    ('saumon',       208, 20,  0, 13),
    ('tofu',         144, 15,  3,  9),
    ('carotte',       41,  1, 10,  0),
    ('courgette',     17,  1,  3,  0),
    ('fromage',      350, 25,  1, 28),
    ('beurre',       750,  1,  1, 82),
    ('pâtes',        360, 12, 72,  2),
    ('boeuf',        250, 26,  0, 15);
