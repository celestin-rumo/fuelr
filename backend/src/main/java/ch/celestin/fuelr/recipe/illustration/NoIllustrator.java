package ch.celestin.fuelr.recipe.illustration;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.Optional;

/** What is left when no token is set: nothing is drawn, and nothing fails. */
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
public class NoIllustrator implements RecipeIllustrator {

    @Override
    public String name() {
        return "none";
    }

    @Override
    public boolean available() {
        return false;
    }

    @Override
    public Optional<byte[]> illustrate(String prompt) {
        return Optional.empty();
    }
}
