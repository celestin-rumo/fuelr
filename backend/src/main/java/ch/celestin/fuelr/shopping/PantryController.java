package ch.celestin.fuelr.shopping;

import ch.celestin.fuelr.shopping.ShoppingDtos.PantryItemView;
import ch.celestin.fuelr.shopping.ShoppingDtos.PantryRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/pantry")
public class PantryController {

    private final PantryService pantry;

    public PantryController(PantryService pantry) {
        this.pantry = pantry;
    }

    @GetMapping
    public List<PantryItemView> mine(@AuthenticationPrincipal Jwt principal) {
        return pantry.of(userId(principal)).stream().map(PantryController::toView).toList();
    }

    /** PUT, not POST: declaring the same thing twice sets the amount, once. */
    @PutMapping
    public PantryItemView stock(
            @AuthenticationPrincipal Jwt principal,
            @Valid @RequestBody PantryRequest body) {
        return toView(pantry.stock(userId(principal), body));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unstock(@AuthenticationPrincipal Jwt principal, @PathVariable Long id) {
        pantry.unstock(userId(principal), id);
    }

    private static PantryItemView toView(PantryItem item) {
        return new PantryItemView(
                item.getId(), item.getName(), item.getQuantity().doubleValue(),
                item.getUnit(), item.getUpdatedAt());
    }

    private static Long userId(Jwt principal) {
        return Long.valueOf(principal.getSubject());
    }
}
