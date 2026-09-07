package ch.celestin.fuelr.preferences;

import java.util.List;
import java.util.Locale;

/**
 * The fourteen allergens of the European declaration, and the words an
 * ingredient line uses for each.
 *
 * Closed, like the seasons and the cuisines: "without peanuts" has to be
 * computable. The word lists are what makes it so — an allergy the model is
 * *asked* to respect is not respected until the code has read the lines that
 * came back, and these words are what it reads them with. Deliberately
 * broad: a false hit drops one dish from a proposal, a miss puts one on a
 * plate.
 */
public enum Allergen {
    GLUTEN("blé", "farine", "seigle", "orge", "épeautre", "kamut", "avoine", "pâtes", "pain",
            "semoule", "boulgour", "couscous", "chapelure", "wheat", "flour", "rye", "barley",
            "spelt", "pasta", "bread", "weizen", "mehl", "roggen", "gerste", "dinkel", "nudeln",
            "brot"),
    CRUSTACEANS("crevette", "gambas", "langoustine", "homard", "crabe", "écrevisse", "langouste",
            "shrimp", "prawn", "lobster", "crab", "garnele", "hummer", "krabbe", "krebs"),
    EGGS("œuf", "oeuf", "egg", "ei", "eier", "mayonnaise"),
    FISH("poisson", "saumon", "thon", "cabillaud", "morue", "truite", "sardine", "anchois",
            "maquereau", "lieu", "colin", "dorade", "bar", "fish", "salmon", "tuna", "cod",
            "trout", "anchovy", "mackerel", "fisch", "lachs", "thunfisch", "kabeljau", "forelle",
            "sardellen"),
    PEANUTS("cacahuète", "cacahuete", "arachide", "peanut", "erdnuss", "erdnüsse"),
    SOY("soja", "tofu", "tempeh", "edamame", "miso", "soy", "soya"),
    MILK("lait", "beurre", "crème", "creme", "fromage", "yaourt", "yogourt", "mozzarella",
            "parmesan", "gruyère", "gruyere", "ricotta", "mascarpone", "feta", "milk", "butter",
            "cream", "cheese", "yogurt", "milch", "butter", "rahm", "sahne", "käse", "kaese",
            "joghurt", "quark"),
    NUTS("noix", "noisette", "amande", "pistache", "cajou", "pécan", "pecan", "macadamia",
            "nut", "walnut", "hazelnut", "almond", "pistachio", "cashew", "nuss", "nüsse",
            "haselnuss", "mandel", "pistazie"),
    CELERY("céleri", "celeri", "celery", "sellerie"),
    MUSTARD("moutarde", "mustard", "senf"),
    SESAME("sésame", "sesame", "tahini", "tahin", "sesam"),
    SULPHITES("sulfite", "sulphite", "sulfit", "vin blanc", "vinaigre de vin"),
    LUPIN("lupin", "lupine"),
    MOLLUSCS("moule", "huître", "huitre", "calamar", "calmar", "seiche", "poulpe", "coquille",
            "palourde", "bulot", "escargot", "mussel", "oyster", "squid", "octopus", "clam",
            "scallop", "muschel", "auster", "tintenfisch", "schnecke");

    private final List<String> words;

    Allergen(String... words) {
        this.words = List.of(words);
    }

    /** Whether an ingredient line, as written, names this allergen. */
    public boolean namedBy(String ingredientName) {
        String lower = " " + normalise(ingredientName) + " ";
        for (String word : words) {
            if (lower.contains(" " + normalise(word)) || lower.contains(normalise(word) + " ")) {
                return true;
            }
        }
        return false;
    }

    static String normalise(String value) {
        return java.text.Normalizer.normalize(value.toLowerCase(Locale.ROOT), java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replace("œ", "oe")
                .replaceAll("[^a-z0-9 ]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    public static Allergen parseOrNull(String value) {
        try {
            return valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException | NullPointerException e) {
            return null;
        }
    }
}
