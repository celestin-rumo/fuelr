package ch.celestin.fuelr.preferences;

import java.util.List;
import java.util.Set;

/**
 * What a proposal has to respect, in two halves that are handled two ways.
 *
 * The closed lists — a diet, the allergens — are **told to the model and
 * checked by the code**: the prompt carries them so the answer is likely to
 * comply, and `allows` reads the ingredient lines that come back so it
 * actually does. A model is asked; the code verifies. An allergy filtered by
 * the model alone is not filtered.
 *
 * The free line is **quoted and never obeyed**, the same rule as the refusal
 * note: it reaches the prompt between quotation marks, as something a person
 * said, and nothing in the code acts on it.
 */
public record Constraints(Diet diet, Set<Allergen> allergens, String dislikes) {

    public static final Constraints NONE = new Constraints(Diet.NONE, Set.of(), null);

    public static Constraints of(DietaryPreferences preferences) {
        if (preferences == null) {
            return NONE;
        }
        return new Constraints(preferences.getDiet(), preferences.getAllergens(),
                preferences.getDislikes());
    }

    public boolean isEmpty() {
        return diet == Diet.NONE && allergens.isEmpty() && (dislikes == null || dislikes.isBlank());
    }

    /** Whether a dish written as these ingredient names may be proposed. */
    public boolean allows(List<String> ingredientNames) {
        for (String name : ingredientNames) {
            if (name == null) {
                continue;
            }
            if (diet.brokenBy(name)) {
                return false;
            }
            for (Allergen allergen : allergens) {
                if (allergen.namedBy(name)) {
                    return false;
                }
            }
        }
        return true;
    }

    /** The closed half, in the language the prompts are written in. */
    public String inFrench() {
        StringBuilder out = new StringBuilder();
        switch (diet) {
            case VEGETARIAN -> out.append(" Tous les plats sont végétariens : ni viande ni poisson.");
            case VEGAN -> out.append(" Tous les plats sont végétaliens : aucun produit animal.");
            case PESCATARIAN -> out.append(" Aucune viande ; le poisson est permis.");
            default -> { }
        }
        if (!allergens.isEmpty()) {
            out.append(" Allergies, à exclure strictement de chaque ingrédient : ")
                    .append(String.join(", ", allergens.stream().map(Constraints::allergenInFrench).toList()))
                    .append(".");
        }
        return out.toString();
    }

    private static String allergenInFrench(Allergen allergen) {
        return switch (allergen) {
            case GLUTEN -> "gluten (blé, seigle, orge, épeautre)";
            case CRUSTACEANS -> "crustacés";
            case EGGS -> "œufs";
            case FISH -> "poisson";
            case PEANUTS -> "arachides";
            case SOY -> "soja";
            case MILK -> "lait et produits laitiers";
            case NUTS -> "fruits à coque";
            case CELERY -> "céleri";
            case MUSTARD -> "moutarde";
            case SESAME -> "sésame";
            case SULPHITES -> "sulfites";
            case LUPIN -> "lupin";
            case MOLLUSCS -> "mollusques";
        };
    }
}
