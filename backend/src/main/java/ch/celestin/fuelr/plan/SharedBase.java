package ch.celestin.fuelr.plan;

import ch.celestin.fuelr.shopping.ShoppingService;

/**
 * What counts as work two dishes can share.
 *
 * **Sharing an ingredient is not sharing work.** Two dishes that both use
 * onion do not get prepared together for that reason, and a set built by
 * counting every ingredient in common produces absurd groupings that look
 * rigorous — four dishes "sharing" salt, pepper and olive oil. So the rule
 * here is deliberately narrow, and it is the same rule in both directions:
 * when a set is proposed, and when a week already on the plan is organised.
 *
 * Two conditions, and both are about quantity rather than about names:
 *
 * <ul>
 *   <li>The unit has to be one you weigh or count — {@code g}, {@code ml},
 *       {@code pcs}. A tablespoon of anything is a seasoning by definition, so
 *       {@code c.à.s} and {@code c.à.c} never carry a base. A line with no unit
 *       at all is one the reader could not split — "sel, poivre", "une poignée
 *       de coriandre" — and it counts for nothing, as it does everywhere else.
 *   <li>And the amount has to be a real one. This is what keeps saffron out:
 *       four dishes sharing a pinch of it share a coincidence, not a
 *       preparation, and nobody ever roasts 100 g of it.
 * </ul>
 *
 * The floors are on the low side on purpose. A base missed is a group somebody
 * makes themselves; a base invented is an afternoon spent following a plan
 * that was never true.
 */
public final class SharedBase {

    private SharedBase() {
    }

    /** 100 g of something is a preparation. A gram of it is a seasoning. */
    private static final double GRAMS = 100;

    /** The same, by volume. */
    private static final double MILLILITRES = 100;

    /**
     * Two pieces, not one.
     *
     * One onion in each of four dishes is exactly the case this whole file
     * exists to refuse: it is in everything, and peeling it four times on
     * Sunday saves nobody anything.
     */
    private static final double PIECES = 2;

    /** Whether this line is a base rather than a seasoning. */
    public static boolean carriesWork(String unit, double quantity) {
        if (unit == null) {
            return false;
        }
        return switch (unit) {
            case "g" -> quantity >= GRAMS;
            case "ml" -> quantity >= MILLILITRES;
            case "pcs" -> quantity >= PIECES;
            default -> false;
        };
    }

    /**
     * How two lines are recognised as the same thing.
     *
     * The shopping list's own definition, and there must not be a second one:
     * a base counted under one key and bought under another is a plan that
     * disagrees with the list it was built from.
     */
    public static String keyOf(String name, String unit) {
        return ShoppingService.key(ShoppingService.matchName(name), unit);
    }
}
