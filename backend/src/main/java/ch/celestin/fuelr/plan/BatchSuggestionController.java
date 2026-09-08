package ch.celestin.fuelr.plan;

import ch.celestin.fuelr.ai.AiBudget;
import ch.celestin.fuelr.menu.IdeaStreams;
import ch.celestin.fuelr.menu.MenuDtos;
import ch.celestin.fuelr.menu.MenuIntelligence;
import ch.celestin.fuelr.recipe.Cuisine;
import ch.celestin.fuelr.recipe.illustration.IllustrationService;
import ch.celestin.fuelr.subscription.Entitlements;
import ch.celestin.fuelr.subscription.Feature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Dishes invented so that the work is shareable.
 *
 * Like the week fill, and for the same reason: this asks for dishes somebody
 * has not had, so proposing back what is already in their library is not an
 * answer. What it adds is that the dishes have to be *a set* — built on the
 * same base, so the peeling and the roasting happen once.
 *
 * **The set is checked, never taken on trust.** A model is asked for a common
 * base and the answer is put through `SharedBase`: only units you weigh or
 * count carry one, and only real amounts, so three dishes "sharing" a teaspoon
 * of salt come back as no set at all. Asking for a common base and being told
 * there is one are two different things, and only the second is checkable.
 *
 * Nothing here writes to the plan, and every refusal has a name — a screen
 * that declines without saying which refusal it is teaches somebody to stop
 * pressing the button.
 */
@RestController
@RequestMapping("/api/plan/suggest/batch")
public class BatchSuggestionController {

    private static final Logger log = LoggerFactory.getLogger(BatchSuggestionController.class);

    /**
     * How many dishes one session may be asked to cover.
     *
     * Six, because a Sunday afternoon is a Sunday afternoon. Below two there is
     * no sharing to speak of.
     */
    private static final int MOST = 6;
    private static final int FEWEST = 2;

    public record Request(
            Integer size,
            Set<String> intents,
            Set<String> cuisines,
            /** Titles already seen or refused; an idea has no id. */
            Set<String> excludeTitles) {
    }

    public record BaseView(String name, String unit, double quantity, int dishes) {
    }

    public record MemberView(
            String title,
            Integer minutes,
            /** Everything it takes to become a draft, without a second bill. */
            WeekSuggestionController.Idea idea,
            /** The picture being drawn for it, by key; null when none will be. */
            String illustrationKey) {
    }

    public record SetView(
            List<MemberView> members,
            /** What the set is a set because of. Counted, never asserted. */
            List<BaseView> bases,
            /** How many of the dishes the strongest base is used by. */
            int sharedBy) {
    }

    public record SetsView(
            List<SetView> sets,
            /** NONE while a set came back; otherwise why it did not. */
            String declined) {
    }

    private final Entitlements entitlements;
    private final AiBudget budget;
    private final List<MenuIntelligence> readers;
    private final ch.celestin.fuelr.preferences.DietaryPreferencesRepository preferences;
    private final IdeaStreams streams;
    private final IllustrationService illustrations;

    public BatchSuggestionController(Entitlements entitlements, AiBudget budget,
                                     List<MenuIntelligence> readers,
                                     ch.celestin.fuelr.preferences.DietaryPreferencesRepository preferences,
                                     IdeaStreams streams, IllustrationService illustrations) {
        this.entitlements = entitlements;
        this.budget = budget;
        this.readers = readers;
        this.preferences = preferences;
        this.streams = streams;
        this.illustrations = illustrations;
    }

    @PostMapping
    public SetsView suggest(@AuthenticationPrincipal Jwt principal,
                            @RequestBody Request request) {
        return answer(Long.valueOf(principal.getSubject()), request, MenuIntelligence.Progress.NONE);
    }

    /** The same answer, told dish by dish — see the week's `live`. */
    @PostMapping("/live")
    public SseEmitter live(@AuthenticationPrincipal Jwt principal, @RequestBody Request request) {
        Long userId = Long.valueOf(principal.getSubject());
        return streams.run(progress -> answer(userId, request, progress));
    }

    SetsView answer(Long userId, Request request, MenuIntelligence.Progress progress) {
        int size = Math.min(MOST, Math.max(FEWEST,
                request.size() == null ? 4 : request.size()));

        MenuIntelligence reader = readers.stream()
                .filter(MenuIntelligence::available)
                .findFirst()
                .orElse(readers.get(readers.size() - 1));

        if (!entitlements.has(userId, Feature.AI_MENU)) {
            return nothing(WeekSuggestionController.Declined.PLAN);
        }
        if (!reader.available()) {
            return nothing(WeekSuggestionController.Declined.UNAVAILABLE);
        }
        try {
            budget.require(userId);
        } catch (AiBudget.ExhaustedException e) {
            return nothing(WeekSuggestionController.Declined.BUDGET);
        }

        ch.celestin.fuelr.preferences.Constraints constraints =
                ch.celestin.fuelr.preferences.Constraints.of(preferences.findById(userId).orElse(null));
        boolean drawing = illustrations.available();
        MenuIntelligence.Progress told = new MenuIntelligence.Progress() {
            @Override
            public void dish(int index, int of, String title) {
                if (drawing) {
                    illustrations.illustrateIdea(userId, title);
                }
                progress.dish(index, of, title);
            }

            @Override
            public void completed(int index, int of, Object dish) {
                MenuDtos.Suggestion idea = (MenuDtos.Suggestion) dish;
                if (!constraints.allows(
                        idea.ingredients().stream().map(MenuDtos.Ingredient::name).toList())) {
                    return;
                }
                progress.completed(index, of, new MemberView(idea.title(), idea.minutes(),
                        new WeekSuggestionController.Idea(idea.title(), idea.minutes(),
                                idea.ingredients(), idea.steps()),
                        drawing ? IllustrationService.keyOf(idea.title()) : null));
            }
        };
        try {
            MenuIntelligence.Ideas ideas = reader.suggestBatch(
                    request.intents() == null ? Set.of() : request.intents(),
                    Cuisine.knownNames(request.cuisines()),
                    size, constraints, told);
            budget.record(userId, "BATCH_SUGGESTIONS", reader.name(),
                    ideas.usage().inputTokens(), ideas.usage().outputTokens());

            // Checked by the code, whatever the model was told. A set with one
            // dish dropped for an allergen is still a set if enough remains.
            List<MenuDtos.Suggestion> safe = ideas.suggestions().stream()
                    .filter(idea -> constraints.allows(
                            idea.ingredients().stream().map(MenuDtos.Ingredient::name).toList()))
                    .toList();
            if (safe.size() < FEWEST) {
                return nothing(WeekSuggestionController.Declined.FAILED);
            }
            SetView built = describe(safe, drawing);
            // A set that turns out to share nothing is dropped rather than
            // dressed up: it is the one claim on this screen worth checking.
            return built == null
                    ? nothing(WeekSuggestionController.Declined.FAILED)
                    : new SetsView(List.of(built),
                            WeekSuggestionController.Declined.NONE.name());
        } catch (RuntimeException e) {
            log.warn("No batch ideas came back: {}", e.toString());
            return nothing(WeekSuggestionController.Declined.FAILED);
        }
    }

    /**
     * What a set of ideas actually shares, or null when the answer is "not
     * enough".
     *
     * The bar is that one base is used by more than half the group. Below that
     * the group is a coincidence — two of five dishes both using rice is not a
     * Sunday afternoon saved, and calling it one is how somebody stops
     * trusting every other suggestion on the screen.
     */
    private SetView describe(List<MenuDtos.Suggestion> ideas, boolean drawing) {
        Map<String, BaseView> shared = new LinkedHashMap<>();
        for (MenuDtos.Suggestion idea : ideas) {
            Set<String> counted = new LinkedHashSet<>();
            for (MenuDtos.Ingredient line : idea.ingredients()) {
                if (!SharedBase.carriesWork(line.unit(), line.quantity())) {
                    continue;
                }
                String key = SharedBase.keyOf(line.name(), line.unit());
                // Once per dish: a recipe listing carrots twice still peels
                // them once, and counting it twice inflates the whole set.
                if (!counted.add(key)) {
                    continue;
                }
                shared.merge(key,
                        new BaseView(line.name().trim(), line.unit(), line.quantity(), 1),
                        (current, more) -> new BaseView(current.name(), current.unit(),
                                current.quantity() + more.quantity(),
                                current.dishes() + more.dishes()));
            }
        }

        List<BaseView> bases = shared.values().stream()
                .filter(base -> base.dishes() >= 2)
                .sorted(Comparator.comparingInt(BaseView::dishes).reversed()
                        .thenComparing(BaseView::name))
                .toList();

        int most = bases.isEmpty() ? 0 : bases.get(0).dishes();
        if (most * 2 <= ideas.size()) {
            return null;
        }

        List<MemberView> members = new ArrayList<>();
        for (MenuDtos.Suggestion idea : ideas) {
            members.add(new MemberView(idea.title(), idea.minutes(),
                    new WeekSuggestionController.Idea(idea.title(), idea.minutes(),
                            idea.ingredients(), idea.steps()),
                    drawing ? IllustrationService.keyOf(idea.title()) : null));
        }
        return new SetView(members, bases, most);
    }

    private SetsView nothing(WeekSuggestionController.Declined why) {
        return new SetsView(List.of(), why.name());
    }
}
