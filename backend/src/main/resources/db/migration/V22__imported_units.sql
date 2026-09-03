-- Units an import wrote that this app cannot measure.
--
-- The reader was told the vocabulary was "g, ml, cs, cc, piece". Three of
-- those five do not exist here — the app knows g, ml, pcs, c.à.s and c.à.c —
-- so every photo import that mentioned a spoon or a piece wrote a row nothing
-- downstream could read, and the library answered 400 for that account until
-- it was fixed in code.
--
-- The code no longer writes them. These rows were written before it, and they
-- outlive the import that caused them, so they are corrected here: only values
-- the app has never been able to read are touched, which makes this strictly a
-- repair. Anything else unrecognised is left alone — it now costs a card its
-- figures and nothing more.
UPDATE recipe_ingredients SET unit = 'pcs'
 WHERE lower(trim(unit)) IN ('piece', 'pièce', 'pieces', 'pièces', 'pc', 'unité', 'unite');

UPDATE recipe_ingredients SET unit = 'c.à.s'
 WHERE lower(trim(unit)) IN ('cs', 'c.s', 'càs', 'cuillère à soupe', 'cuillere a soupe');

UPDATE recipe_ingredients SET unit = 'c.à.c'
 WHERE lower(trim(unit)) IN ('cc', 'c.c', 'càc', 'cuillère à café', 'cuillere a cafe');

UPDATE recipe_ingredients SET unit = 'g'
 WHERE lower(trim(unit)) IN ('gr', 'gramme', 'grammes');

UPDATE recipe_ingredients SET unit = 'ml'
 WHERE lower(trim(unit)) = 'cl';
