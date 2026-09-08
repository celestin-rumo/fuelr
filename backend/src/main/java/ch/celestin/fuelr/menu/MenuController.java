package ch.celestin.fuelr.menu;

import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

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
    private final IdeaStreams streams;

    public MenuController(MenuSuggestionService suggestions, IdeaStreams streams) {
        this.suggestions = suggestions;
        this.streams = streams;
    }

    /**
     * The same answer, told as it is written: the library's part arrives
     * inside the first second and the model's dishes are counted after it.
     */
    @PostMapping("/suggestions/live")
    public SseEmitter live(@AuthenticationPrincipal Jwt principal,
                           @Valid @RequestBody MenuDtos.SuggestRequest body) {
        Long userId = Long.valueOf(principal.getSubject());
        return streams.run(progress -> suggestions.suggest(userId, body.have(), progress));
    }

    @PostMapping("/suggestions")
    public MenuDtos.SuggestionsView suggest(
            @AuthenticationPrincipal Jwt principal,
            @Valid @RequestBody MenuDtos.SuggestRequest body) {
        return suggestions.suggest(Long.valueOf(principal.getSubject()), body.have());
    }
}
