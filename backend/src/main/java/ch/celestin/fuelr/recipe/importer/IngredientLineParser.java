package ch.celestin.fuelr.recipe.importer;

import ch.celestin.fuelr.recipe.importer.ParsedRecipe.ParsedIngredient;

import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Turns "400 g de farine" into a quantity, a unit and a name.
 *
 * schema.org gives ingredients as free text, so this is guesswork by nature.
 * What matters is that it never pretends: a line it cannot read keeps its whole
 * text as the name and is flagged, so the editor asks rather than inventing a
 * plausible 1 piece of something.
 */
final class IngredientLineParser {

    /** The units the rest of the application already knows how to weigh. */
    private static final String GRAM = "g";
    private static final String MILLILITRE = "ml";
    private static final String PIECE = "pcs";
    private static final String TABLESPOON = "c.à.s";
    private static final String TEASPOON = "c.à.c";

    /** Written forms seen on French and Swiss recipe sites, and their factor. */
    private static final Map<String, Unit> UNITS = Map.ofEntries(
            Map.entry("g", new Unit(GRAM, 1)),
            Map.entry("gr", new Unit(GRAM, 1)),
            Map.entry("gramme", new Unit(GRAM, 1)),
            Map.entry("grammes", new Unit(GRAM, 1)),
            Map.entry("kg", new Unit(GRAM, 1000)),
            Map.entry("ml", new Unit(MILLILITRE, 1)),
            Map.entry("cl", new Unit(MILLILITRE, 10)),
            Map.entry("dl", new Unit(MILLILITRE, 100)),
            Map.entry("l", new Unit(MILLILITRE, 1000)),
            Map.entry("litre", new Unit(MILLILITRE, 1000)),
            Map.entry("litres", new Unit(MILLILITRE, 1000)),
            // Swiss sites write "cc" and "cs"; French ones spell them out.
            Map.entry("cc", new Unit(TEASPOON, 1)),
            Map.entry("c.c.", new Unit(TEASPOON, 1)),
            Map.entry("càc", new Unit(TEASPOON, 1)),
            Map.entry("cuillère à café", new Unit(TEASPOON, 1)),
            Map.entry("cuillères à café", new Unit(TEASPOON, 1)),
            Map.entry("cuillere à café", new Unit(TEASPOON, 1)),
            Map.entry("cs", new Unit(TABLESPOON, 1)),
            Map.entry("c.s.", new Unit(TABLESPOON, 1)),
            Map.entry("càs", new Unit(TABLESPOON, 1)),
            Map.entry("cuillère à soupe", new Unit(TABLESPOON, 1)),
            Map.entry("cuillères à soupe", new Unit(TABLESPOON, 1)),
            Map.entry("cuillere à soupe", new Unit(TABLESPOON, 1)));

    private record Unit(String name, double toBase) {
    }

    /** Vulgar fractions appear in place of decimals on Swiss pages: "½ cc de sel". */
    private static final Map<Character, Double> FRACTIONS = Map.of(
            '½', 0.5, '¼', 0.25, '¾', 0.75, '⅓', 1.0 / 3, '⅔', 2.0 / 3,
            '⅛', 0.125, '⅕', 0.2, '⅖', 0.4, '⅗', 0.6);

    /**
     * A leading amount, then optionally a unit word, then the rest. The amount
     * accepts "1", "1.5", "1,5", "1/2" and "½".
     */
    private static final Pattern LINE = Pattern.compile(
            "^\\s*(?<amount>\\d+(?:[.,]\\d+)?(?:\\s*/\\s*\\d+)?|[½¼¾⅓⅔⅛⅕⅖⅗])"
                    + "\\s*(?<rest>.*)$");

    private IngredientLineParser() {
    }

    static ParsedIngredient parse(String rawLine) {
        String line = normalise(rawLine);
        if (line.isBlank()) {
            return null;
        }

        Matcher matcher = LINE.matcher(line);
        if (!matcher.matches()) {
            // No amount at all: a heading like "Pour la garniture", or an
            // ingredient given without measure. Either way, not ours to invent.
            return new ParsedIngredient(line, 1, PIECE, true);
        }

        double amount = amountOf(matcher.group("amount"));
        String rest = matcher.group("rest").trim();

        // Longest match wins: "cuillère à soupe" must beat "c", and "dl" must
        // not be shadowed by "d". A local, because a shared field here would
        // be a race between two imports.
        Unit unit = null;
        String name = rest;
        int longest = 0;
        for (var candidate : UNITS.entrySet()) {
            String token = candidate.getKey();
            if (startsWithWord(rest, token) && token.length() > longest) {
                unit = candidate.getValue();
                longest = token.length();
                name = rest.substring(token.length()).trim();
            }
        }

        name = stripLeadingPreposition(name);
        if (name.isBlank()) {
            return new ParsedIngredient(line, amount, PIECE, true);
        }

        if (unit == null) {
            // "2 œufs", "1 sachet de levure": a count of something. Correct as
            // far as it goes, and honest about the unit being assumed.
            return new ParsedIngredient(name, amount, PIECE, true);
        }
        return new ParsedIngredient(name, round(amount * unit.toBase()), unit.name(), false);
    }

    private static double amountOf(String amount) {
        if (amount.length() == 1 && FRACTIONS.containsKey(amount.charAt(0))) {
            return FRACTIONS.get(amount.charAt(0));
        }
        if (amount.contains("/")) {
            String[] parts = amount.split("/");
            double denominator = Double.parseDouble(parts[1].trim());
            return denominator == 0 ? 1 : Double.parseDouble(parts[0].trim()) / denominator;
        }
        return Double.parseDouble(amount.replace(',', '.'));
    }

    private static boolean startsWithWord(String text, String token) {
        String lower = text.toLowerCase(Locale.ROOT);
        if (!lower.startsWith(token)) {
            return false;
        }
        if (text.length() == token.length()) {
            return true;
        }
        char next = text.charAt(token.length());
        // "g de farine" is a unit; "gousse d'ail" is not.
        return !Character.isLetter(next);
    }

    /** "de farine", "d'huile", "of flour" — the join, not part of the name. */
    private static String stripLeadingPreposition(String name) {
        String lower = name.toLowerCase(Locale.ROOT);
        for (String prefix : new String[] {"de ", "d'", "d’", "du ", "des ", "of "}) {
            if (lower.startsWith(prefix)) {
                return name.substring(prefix.length()).trim();
            }
        }
        return name;
    }

    private static String normalise(String raw) {
        return raw == null ? "" : raw.replace(' ', ' ').replaceAll("\\s+", " ").trim();
    }

    private static double round(double value) {
        return Math.round(value * 100d) / 100d;
    }
}
