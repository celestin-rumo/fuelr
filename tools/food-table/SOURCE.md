# Where the food table comes from

**Swiss Food Composition Database**, published by the Federal Food Safety and
Veterinary Office (FSVO / OSAV / BLV).

- Site: <https://naehrwertdaten.ch>
- Also listed on opendata.swiss:
  <https://opendata.swiss/en/dataset/naehrwerte_lebensmittel>
- Version imported: **7.1** (workbooks dated 2026-07)
- Rows imported: 1 216 generic foods, of the 1 416 the workbook lists — a food
  with no energy value is dropped, because energy is the one figure every
  screen in the app asks for and a blank there cannot be shown.

## Why this one

Two reasons, both practical:

- **It is natively multilingual.** German, French, Italian and English are
  published as separate workbooks with the same ids, which is what lets an
  ingredient typed in any of the three languages the app speaks match the same
  row. A French-only table would have left German users on the fallback.
- **It describes what is actually on the shelves here.** A *séré*, a
  *cervelas*, a *Bündnerfleisch* have no clean equivalent in a French or
  American table.

## Terms

The FSVO publishes the data free of charge, in four languages, and states that
it may be used commercially — integrated into nutrition software or a food
diary app — and scientifically, **subject to acknowledgement of the source**.

The attribution the app carries, on the nutrition detail and in the repository:

> Valeurs nutritionnelles : Base de données suisse des valeurs nutritives,
> Office fédéral de la sécurité alimentaire et des affaires vétérinaires (OSAV).

Two things to keep an eye on, because this is a paid product:

- The FSVO notes that part of the material comes from third parties whose own
  publishing terms are not uniform. Before a release that leans harder on this
  data than "compute a recipe's macros", re-read their terms of use.
- The wording above is ours, not a licence template. If they publish a required
  form of attribution, it replaces this one.

**Open Food Facts was deliberately not used**: it is ODbL, which is
share-alike, and a derived database can carry an obligation to be republished.
That is not a decision to take by accident inside a paid product.

If coverage turns out to be short, the intended complement is **Ciqual**
(ANSES, ~3 200 foods, Licence Ouverte / Etalab). Adding it means a second value
in `foods.source`, so each table can be refreshed on its own and every number
can be traced back to where it came from.

## Refreshing it

```bash
docker run --rm -v "$PWD:/repo" -w /repo python:3.12-slim \
    sh -lc 'pip install -q openpyxl requests && python tools/food-table/build.py'
```

That downloads the three workbooks, joins them on their ids and rewrites
`backend/src/main/resources/food/foods.csv` and `names.csv`. Review the diff,
commit it, and the backend re-imports on its next boot — it hashes the two
files and does nothing while the hash is unchanged.

The workbooks themselves are not committed; `tools/food-table/cache/` is
ignored. The CSVs are, because the import has to be reproducible from a
checkout with no network.
