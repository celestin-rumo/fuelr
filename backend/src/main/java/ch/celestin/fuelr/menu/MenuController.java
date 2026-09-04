package ch.celestin.fuelr.menu;

import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * What to cook, from what is in the bag.
 *
 * No entitlement check here, and that is deliberate: the cook's own library is
 * searched for free and answers most of the time. What is paid for is the
 * ideas beyond it, and the service declines those quietly rather than refusing
 * the whole question — a screen that answered "buy a plan" to "what can I make
 * with this?" would be reading the room badly.
 */
@RestController
@RequestMapping("/api/menu")
public class MenuController {

    private final MenuSuggestionService suggestions;

    public MenuController(MenuSuggestionService suggestions) {
        this.suggestions = suggestions;
    }

    @PostMapping("/suggestions")
    public MenuDtos.SuggestionsView suggest(
            @AuthenticationPrincipal Jwt principal,
            @Valid @RequestBody MenuDtos.SuggestRequest body) {
        return suggestions.suggest(Long.valueOf(principal.getSubject()), body.have());
    }
}
