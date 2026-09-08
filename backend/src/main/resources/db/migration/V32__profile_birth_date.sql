-- A birth date instead of an age.
--
-- An age typed at registration is wrong a year later and nobody comes back
-- to fix it; a birth date is true forever and the age is arithmetic. The
-- backfill is honest about what it knows: the year, and nothing finer —
-- January 1st of the year that gives the stored age today.
ALTER TABLE profiles ADD COLUMN birth_date DATE;
UPDATE profiles SET birth_date = make_date(extract(year from now())::int - age, 1, 1);
ALTER TABLE profiles ALTER COLUMN birth_date SET NOT NULL;
ALTER TABLE profiles DROP COLUMN age;
