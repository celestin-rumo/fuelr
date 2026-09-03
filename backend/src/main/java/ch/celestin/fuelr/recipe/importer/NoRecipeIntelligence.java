package ch.celestin.fuelr.recipe.importer;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * The reader that exists while none does.
 *
 * No key is configured, so nothing can be read, and this says so rather than
 * failing at the moment somebody has already chosen their photos. Ordered
 * last, so wiring a real one is adding one `@Component` — the same seam as
 * {@code NoPaymentProvider}, and the same as the recipe parsers before it.
 */
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
public class NoRecipeIntelligence implements RecipeIntelligence {

    @Override
    public String name() {
        return "none";
    }

    @Override
    public boolean available() {
        return false;
    }

    @Override
    public Reading read(List<byte[]> images, Source source) {
        throw new NotAvailableException();
    }

    @Override
    public Reading read(String text) {
        throw new NotAvailableException();
    }
}
