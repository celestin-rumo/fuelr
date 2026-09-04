package ch.celestin.fuelr.menu;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * The one that exists while none does.
 *
 * Ordered last, and it proposes nothing. That is a working state rather than a
 * broken one: the library is searched first and for free, so a cook whose own
 * recipes answer the question never notices that no model was asked.
 */
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
public class NoMenuIntelligence implements MenuIntelligence {

    @Override
    public String name() {
        return "none";
    }

    @Override
    public boolean available() {
        return false;
    }

    @Override
    public Ideas suggest(String have, int wanted, List<String> already) {
        return new Ideas(List.of(), new ch.celestin.fuelr.recipe.importer.RecipeIntelligence.Usage(0, 0));
    }
}
