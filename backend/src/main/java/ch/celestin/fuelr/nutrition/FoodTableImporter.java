package ch.celestin.fuelr.nutrition;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

/**
 * Loads the reference food table out of the CSVs and into the database.
 *
 * Replayable by construction: it hashes the two files, compares that with what
 * it imported last time, and does nothing when they match. Following a new
 * release of the source is therefore regenerating the CSVs
 * (`tools/food-table/build.py`), reviewing the diff, and booting — not editing
 * SQL by hand and hoping every environment ran it.
 *
 * An import replaces every row of its own source and leaves any other source
 * alone, so a second table can be added later and refreshed on its own.
 */
@Component
public class FoodTableImporter implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(FoodTableImporter.class);

    /** Swiss Food Composition Database, FSVO — see tools/food-table/SOURCE.md. */
    static final String SOURCE = "BLV";

    private static final String FOODS = "food/foods.csv";
    private static final String NAMES = "food/names.csv";

    private final JdbcTemplate jdbc;
    private final FoodImportRepository imports;
    private final FoodMatcher matcher;

    public FoodTableImporter(JdbcTemplate jdbc, FoodImportRepository imports, FoodMatcher matcher) {
        this.jdbc = jdbc;
        this.imports = imports;
        this.matcher = matcher;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        importIfChanged();
    }

    @Transactional
    public void importIfChanged() throws IOException {
        List<String[]> foodRows = read(FOODS);
        List<String[]> nameRows = read(NAMES);
        String checksum = checksumOf(foodRows, nameRows);

        var previous = imports.findBySource(SOURCE);
        if (previous.isPresent() && previous.get().getChecksum().equals(checksum)) {
            matcher.reload();
            return;
        }

        log.info("Importing the {} food table: {} foods, {} names.",
                SOURCE, foodRows.size() - 1, nameRows.size() - 1);

        // The whole source is replaced rather than merged. A row that upstream
        // withdrew has to disappear, and a merge would leave it behind for
        // ever with nothing to say where it came from.
        jdbc.update("DELETE FROM foods WHERE source = ?", SOURCE);

        Map<String, Long> ids = insertFoods(foodRows);
        insertNames(nameRows, ids);

        int count = ids.size();
        imports.findBySource(SOURCE)
                .map(existing -> {
                    existing.update(checksum, count);
                    return imports.save(existing);
                })
                .orElseGet(() -> imports.save(new FoodImport(SOURCE, checksum, count)));

        matcher.reload();
        log.info("Food table imported: {} foods.", count);
    }

    // --- the files ----------------------------------------------------------

    /**
     * The narrowest CSV reader that reads these files, and no wider.
     *
     * The generator writes them with Python's csv module: comma separated,
     * quotes doubled inside a quoted field, and no newlines inside a field
     * because no food name has one.
     */
    private static List<String[]> read(String path) throws IOException {
        List<String[]> rows = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                new ClassPathResource(path).getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (!line.isBlank()) {
                    rows.add(split(line));
                }
            }
        }
        return rows;
    }

    static String[] split(String line) {
        List<String> fields = new ArrayList<>();
        StringBuilder field = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (quoted) {
                if (c == '"') {
                    if (i + 1 < line.length() && line.charAt(i + 1) == '"') {
                        field.append('"');
                        i++;
                    } else {
                        quoted = false;
                    }
                } else {
                    field.append(c);
                }
            } else if (c == '"') {
                quoted = true;
            } else if (c == ',') {
                fields.add(field.toString());
                field.setLength(0);
            } else {
                field.append(c);
            }
        }
        fields.add(field.toString());
        return fields.toArray(String[]::new);
    }

    private static String checksumOf(List<String[]> foods, List<String[]> names) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            for (List<String[]> rows : List.of(foods, names)) {
                for (String[] row : rows) {
                    digest.update(String.join("", row).getBytes(StandardCharsets.UTF_8));
                }
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 is required by every JVM", e);
        }
    }

    // --- the rows -----------------------------------------------------------

    private Map<String, Long> insertFoods(List<String[]> rows) {
        String[] header = rows.get(0);
        int refAt = indexOf(header, "ref");
        int categoryAt = indexOf(header, "category");
        int aisleAt = indexOf(header, "aisle");
        List<String> macros = List.of("kcal", "protein_g", "carbs_g", "fat_g",
                "fibre_g", "sugars_g", "salt_g");
        // Everything the generator wrote that is not a macro or an identifier
        // is a micronutrient, so adding one upstream needs no change here.
        List<String> micros = new ArrayList<>();
        for (String column : header) {
            if (!macros.contains(column) && !List.of("ref", "category", "aisle").contains(column)) {
                micros.add(column);
            }
        }

        List<Object[]> foodBatch = new ArrayList<>();
        for (String[] row : rows.subList(1, rows.size())) {
            foodBatch.add(new Object[] {
                    SOURCE, row[refAt], trim(row[categoryAt], 160), row[aisleAt],
                    number(row[indexOf(header, "kcal")]),
                    number(row[indexOf(header, "protein_g")]),
                    number(row[indexOf(header, "carbs_g")]),
                    number(row[indexOf(header, "fat_g")]),
                    number(row[indexOf(header, "fibre_g")]),
                    number(row[indexOf(header, "sugars_g")]),
                    number(row[indexOf(header, "salt_g")]),
            });
        }
        jdbc.batchUpdate("""
                INSERT INTO foods (source, source_ref, category, aisle, kcal,
                                   protein_g, carbs_g, fat_g, fibre_g, sugars_g, salt_g)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, foodBatch);

        Map<String, Long> ids = new java.util.HashMap<>();
        jdbc.query("SELECT id, source_ref FROM foods WHERE source = ?",
                rs -> {
                    ids.put(rs.getString("source_ref"), rs.getLong("id"));
                }, SOURCE);

        List<Object[]> microBatch = new ArrayList<>();
        for (String[] row : rows.subList(1, rows.size())) {
            Long foodId = ids.get(row[refAt]);
            if (foodId == null) continue;
            for (String code : micros) {
                BigDecimal amount = number(row[indexOf(header, code)]);
                if (amount != null) {
                    microBatch.add(new Object[] { foodId, code, amount, unitOf(code) });
                }
            }
        }
        jdbc.batchUpdate(
                "INSERT INTO food_micronutrients (food_id, code, amount, unit) VALUES (?, ?, ?, ?)",
                microBatch);
        return ids;
    }

    private void insertNames(List<String[]> rows, Map<String, Long> ids) {
        String[] header = rows.get(0);
        int refAt = indexOf(header, "ref");
        int localeAt = indexOf(header, "locale");
        int nameAt = indexOf(header, "name");
        int normalisedAt = indexOf(header, "normalised");

        List<Object[]> batch = new ArrayList<>();
        java.util.Set<String> seen = new java.util.HashSet<>();
        for (String[] row : rows.subList(1, rows.size())) {
            Long foodId = ids.get(row[refAt]);
            if (foodId == null) continue;
            String normalised = trim(row[normalisedAt], 255);
            // The unique key is (food, locale, normalised): a food whose name
            // and synonym normalise to the same thing offers it once.
            if (!seen.add(foodId + "|" + row[localeAt] + "|" + normalised)) continue;
            batch.add(new Object[] {
                    foodId, row[localeAt], trim(row[nameAt], 255), normalised });
        }
        jdbc.batchUpdate(
                "INSERT INTO food_names (food_id, locale, name, normalised) VALUES (?, ?, ?, ?)",
                batch);
    }

    /** The generator writes µg as "ug"; everything else is milligrams or grams. */
    private static String unitOf(String code) {
        return switch (code) {
            case "selenium", "iodine", "vitamin_a", "vitamin_b12", "folate", "vitamin_d" -> "ug";
            case "saturated_fat" -> "g";
            default -> "mg";
        };
    }

    private static int indexOf(String[] header, String column) {
        for (int i = 0; i < header.length; i++) {
            if (header[i].equals(column)) {
                return i;
            }
        }
        throw new IllegalStateException("the food CSV has no column named " + column);
    }

    private static BigDecimal number(String raw) {
        return raw == null || raw.isBlank() ? null : new BigDecimal(raw);
    }

    private static String trim(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }
}
