package ch.celestin.fuelr.nutrition;

import org.springframework.stereotype.Component;

import java.text.Normalizer;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Turns what a cook wrote into a food the reference table knows.
 *
 * With two dozen entries a substring search was enough. With twelve hundred it
 * is actively wrong: "lait" is inside "lait de coco", "chocolat au lait" and
 * "lait écrémé", and taking the first row that matched made the answer depend
 * on the order the database happened to return — an unrelated UPDATE once
 * turned lentils into garlic that way.
 *
 * There is a second mismatch, and it runs the other way. A composition table
 * names foods precisely — "Oignon, cru", "Lait entier, pasteurisé", "Farine
 * (moyenne)" — while a cook writes "oignon", "lait entier", "farine". Looking
 * for the published name inside what was typed therefore finds almost nothing:
 * it is the typed text that is inside the published name.
 *
 * So each name is indexed three times, from most to least specific:
 *
 *   1. the whole name — "lait de coco";
 *   2. its head, the part before the first comma or bracket — "oignon" out of
 *      "Oignon, cru";
 *   3. the head's first word — "eau" out of "Eau du robinet".
 *
 * Where several foods answer to one key, the one with the shortest full name
 * wins: fewest qualifiers is the plainest version of the thing, which is what
 * somebody writing just "oignon" means.
 *
 * Matching then normalises what was written, cuts it into words, and tries
 * every run of consecutive words — longest first, left to right, consulting
 * the three indexes in order at each run. Whole words are what stops "ail"
 * matching "corail"; longest-first is what makes "lait de coco" beat "lait".
 * The order is fixed, so the same text always gives the same food, whatever
 * the database returns in whatever order.
 *
 * Plurals are handled crudely, by also indexing each key with a trailing "s"
 * or "x" removed from every word. It is not morphology, and it is not meant to
 * be: it turns "lentilles" into "lentille" and stops there.
 */
@Component
public class FoodMatcher {

    /** Longer than any food name in the table, and short enough to stay cheap. */
    static final int MAX_WORDS = 7;

    /** Below this a "name" matches half the language. */
    static final int MIN_KEY_LENGTH = 2;

    private final FoodRepository foods;
    private final FoodNameRepository names;

    /**
     * Built once and replaced wholesale, never mutated in place: a request
     * reading it while an import rebuilds it sees the old index or the new
     * one, and never a half-built one.
     */
    private volatile Map<String, Long> full = Map.of();
    private volatile Map<String, Long> heads = Map.of();
    private volatile Map<String, Long> firstWords = Map.of();
    private volatile Map<Long, Food> byId = Map.of();
    private volatile boolean loaded = false;

    public FoodMatcher(FoodRepository foods, FoodNameRepository names) {
        this.foods = foods;
        this.names = names;
    }

    /**
     * Lowercased, unaccented, and everything that is not a letter or a digit
     * turned into a single space.
     *
     * `tools/food-table/build.py` implements the same rule, because it is what
     * the stored `normalised` column holds. {@code FoodMatcherTest} runs both
     * against the same examples: if they drift, names are stored in one shape
     * and looked up in another, and nothing matches at all.
     */
    public static String normalise(String value) {
        // Ligatures first: NFD does not take "œ" apart, so "œuf" would lose it
        // entirely and never meet the "oeuf" somebody typed.
        String expanded = value.toLowerCase(Locale.ROOT)
                .replace("œ", "oe")
                .replace("æ", "ae")
                .replace("ß", "ss");
        String folded = Normalizer.normalize(expanded, Normalizer.Form.NFD)
                .replaceAll("\\p{Mn}+", "");
        return folded.replaceAll("[^a-z0-9]+", " ").trim();
    }

    /** The part before the first qualifier: "Oignon, cru" is an onion. */
    static String head(String normalisedName, String rawName) {
        int comma = rawName.indexOf(',');
        int bracket = rawName.indexOf('(');
        int cut = comma < 0 ? bracket : (bracket < 0 ? comma : Math.min(comma, bracket));
        return cut <= 0 ? normalisedName : normalise(rawName.substring(0, cut));
    }

    /**
     * Crude singulars, one per ending worth undoing.
     *
     * Three languages, three ways of making a plural: "lentilles" and "choux"
     * in French, "tomatoes" and "strawberries" in English, "Karotten" and
     * "Erdbeeren" in German. This is not morphology — it chops endings and
     * tries the results — and it is applied to both the stored key and the
     * text being looked up, so a singular in the table meets a plural in the
     * recipe whichever way round they are.
     */
    static List<String> folds(String normalised) {
        List<String> candidates = new java.util.ArrayList<>();
        candidates.add(normalised);
        for (String[] ending : ENDINGS) {
            String folded = chop(normalised, ending[0], ending[1]);
            if (folded != null && !candidates.contains(folded)) {
                candidates.add(folded);
            }
        }
        return candidates;
    }

    /** Longest ending first, so "ies" is tried before "s". */
    private static final String[][] ENDINGS = {
            { "ies", "y" }, { "es", "" }, { "en", "" },
            { "s", "" }, { "x", "" }, { "n", "" }, { "e", "" },
    };

    /** Applies one ending to every word, or answers null when none carries it. */
    private static String chop(String normalised, String ending, String replacement) {
        StringBuilder folded = new StringBuilder();
        boolean changed = false;
        for (String word : normalised.split(" ")) {
            if (word.length() > ending.length() + 2 && word.endsWith(ending)) {
                folded.append(word, 0, word.length() - ending.length()).append(replacement);
                changed = true;
            } else {
                folded.append(word);
            }
            folded.append(' ');
        }
        return changed ? folded.toString().trim() : null;
    }

    /** The food a written ingredient names, when the table knows one. */
    public Optional<Food> match(String written) {
        if (written == null || written.isBlank()) {
            return Optional.empty();
        }
        ensureLoaded();

        String[] words = normalise(written).split(" ");
        int longest = Math.min(MAX_WORDS, words.length);
        for (int size = longest; size >= 1; size--) {
            for (int start = 0; start + size <= words.length; start++) {
                String run = String.join(" ", java.util.Arrays.copyOfRange(words, start, start + size));
                // Most specific index first, so a longer run never loses to a
                // vaguer key of the same length.
                for (Map<String, Long> index : List.of(full, heads, firstWords)) {
                    for (String candidate : folds(run)) {
                        Long foodId = index.get(candidate);
                    Food food = foodId == null ? null : byId.get(foodId);
                        if (food != null) {
                            return Optional.of(food);
                        }
                    }
                }
            }
        }
        return Optional.empty();
    }

    /** Called by the importer once new rows are in. */
    public synchronized void reload() {
        Map<Long, Food> loadedFoods = new HashMap<>();
        for (Food food : foods.findAll()) {
            loadedFoods.put(food.getId(), food);
        }

        Map<String, Long> loadedFull = new HashMap<>();
        Map<String, Long> loadedHeads = new HashMap<>();
        Map<String, Long> loadedFirst = new HashMap<>();
        // How long the food's plainest name is, per key: fewest qualifiers is
        // the plainest version of the thing.
        Map<String, Integer> fullLength = new HashMap<>();
        Map<String, Integer> headLength = new HashMap<>();
        Map<String, Integer> firstLength = new HashMap<>();

        for (FoodName name : names.findAll()) {
            String normalised = name.getNormalised();
            int length = normalised.length();
            for (String candidate : folds(normalised)) {
                put(loadedFull, fullLength, candidate, length, name.getFoodId());
            }

            String head = head(normalised, name.getName());
            for (String candidate : folds(head)) {
                put(loadedHeads, headLength, candidate, length, name.getFoodId());
            }

            int space = head.indexOf(' ');
            if (space > 0) {
                for (String candidate : folds(head.substring(0, space))) {
                    put(loadedFirst, firstLength, candidate, length, name.getFoodId());
                }
            }
        }

        this.byId = Map.copyOf(loadedFoods);
        this.full = Map.copyOf(loadedFull);
        this.heads = Map.copyOf(loadedHeads);
        this.firstWords = Map.copyOf(loadedFirst);
        this.loaded = true;
    }

    /**
     * Several foods answer to one key: "oignon" heads four of them, and a
     * synonym of one food is the name of another. The shortest full name wins,
     * ties broken by the lower id — arbitrary, but fixed, so the same text
     * never resolves to different foods on two runs.
     */
    private static void put(Map<String, Long> index, Map<String, Integer> lengths,
                            String key, int length, Long foodId) {
        if (key.length() < MIN_KEY_LENGTH) {
            return;
        }
        Integer best = lengths.get(key);
        if (best == null || length < best || (length == best && foodId < index.get(key))) {
            index.put(key, foodId);
            lengths.put(key, length);
        }
    }

    private void ensureLoaded() {
        if (!loaded) {
            reload();
        }
    }
}
