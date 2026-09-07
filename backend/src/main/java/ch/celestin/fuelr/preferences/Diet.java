package ch.celestin.fuelr.preferences;

import java.util.List;
import java.util.Locale;

/**
 * What somebody does not eat as a rule, rather than because it would make
 * them ill. Closed, and each one carries the words that break it.
 */
public enum Diet {
    NONE(),
    PESCATARIAN(Words.MEAT),
    VEGETARIAN(Words.concat(Words.MEAT, Words.FISH)),
    VEGAN(Words.concat(Words.MEAT, Words.FISH, Words.ANIMAL));

    /**
     * A nested holder rather than fields on the enum: an enum constant may
     * not read a static field declared below it, and the constants come
     * first by grammar.
     */
    private static final class Words {
    static final String[] MEAT = {
            "poulet", "bœuf", "boeuf", "porc", "veau", "agneau", "canard", "dinde", "lard",
            "lardon", "jambon", "saucisse", "saucisson", "bacon", "viande", "steak", "escalope",
            "chicken", "beef", "pork", "veal", "lamb", "duck", "turkey", "ham", "sausage", "meat",
            "huhn", "hähnchen", "rind", "schwein", "kalb", "lamm", "ente", "pute", "speck",
            "schinken", "wurst", "fleisch"};
    static final String[] FISH = {
            "poisson", "saumon", "thon", "cabillaud", "truite", "crevette", "moule", "calamar",
            "anchois", "sardine", "fish", "salmon", "tuna", "cod", "shrimp", "prawn", "mussel",
            "fisch", "lachs", "thunfisch", "garnele"};
    static final String[] ANIMAL = {
            "œuf", "oeuf", "lait", "beurre", "crème", "creme", "fromage", "yaourt", "miel",
            "egg", "milk", "butter", "cream", "cheese", "yogurt", "honey",
            "ei", "eier", "milch", "butter", "rahm", "sahne", "käse", "joghurt", "honig"};

    static String[] concat(String[]... parts) {
        return java.util.Arrays.stream(parts).flatMap(java.util.Arrays::stream).toArray(String[]::new);
    }
    }

    private final List<String> words;

    Diet(String... words) {
        this.words = List.of(words);
    }

    public boolean brokenBy(String ingredientName) {
        String lower = " " + Allergen.normalise(ingredientName) + " ";
        for (String word : words) {
            String w = Allergen.normalise(word);
            if (lower.contains(" " + w + " ") || lower.contains(" " + w + "s ")) {
                return true;
            }
        }
        return false;
    }

    public static Diet parseOrDefault(String value) {
        try {
            return valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException | NullPointerException e) {
            return NONE;
        }
    }
}
