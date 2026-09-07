-- Whether a planned meal still has anything to buy.
--
-- Default true, because the ordinary case is that a meal on Thursday needs
-- shopping for. Turning it off is somebody saying "I already have everything
-- for this one" — the meal stays on the plan, keeps its figures, and is still
-- cooked; only the shopping list stops asking for it.
ALTER TABLE planned_meals
    ADD COLUMN in_shopping BOOLEAN NOT NULL DEFAULT TRUE;
