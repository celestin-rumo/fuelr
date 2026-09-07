package ch.celestin.fuelr.plan;

import ch.celestin.fuelr.ai.AiBudget;
import ch.celestin.fuelr.menu.MenuDtos;
import ch.celestin.fuelr.menu.MenuIntelligence;
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

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Dishes that batch together.
 *
 * The library answers first and for free, because whether two recipes share a
 * base is arithmetic over lines that are already stored. A model is asked only
 * when the library cannot form a single set — and what *it* returns is put
 * through the same arithmetic, so a set always says what it shares because
 * somebody counted, never because something claimed it.
 *
 * Nothing here writes to the plan. Accepting a set is the same act as accepting
 * any other proposal in this epic: dish by dish, onto days.
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
            /** Recipes not to propose: already planned, or already refused. */
            Set<Long> exclude) {
    }

    public record BaseView(String name, String unit, double quantity, int dishes) {
    }

    public record MemberView(
            /** Null for an idea: it is not a recipe yet, and may never be. */
            Long recipeId,
            String title,
            Integer minutes,
            String cuisine,
            Set<String> tags,
            boolean hasPhoto,
            /** Somebody had already said this one suits batch cooking. */
            boolean taggedBatch,
            /** Present only for an idea, so accepting can make a draft of it. */
            WeekSuggestionController.Idea idea) {
    }

    public record SetView(
            List<MemberView> members,
            /** What the set is a set because of. Counted, never asserted. */
            List<BaseView> bases,
            /** How many of the dishes the strongest base is used by. */
            int sharedBy) {
    }

    public record SetsView(List<SetView> sets, boolean assisted) {
    }

    private final BatchSuggestionService batches;
    private final Entitlements entitlements;
    private final AiBudget budget;
    private final List<MenuIntelligence> readers;

    public BatchSuggestionController(BatchSuggestionService batches,
                                     Entitlements entitlements, AiBudget budget,
                                     List<MenuIntelligence> readers) {
        this.batches = batches;
        this.entitlements = entitlements;
        this.budget = budget;
        this.readers = readers;
    }

    @PostMapping
    public SetsView suggest(@AuthenticationPrincipal Jwt principal,
                            @RequestBody Request request) {
        Long userId = Long.valueOf(principal.getSubject());
        int size = Math.min(MOST, Math.max(FEWEST,
                request.size() == null ? 4 : request.size()));

        List<SetView> own = batches
                .fromLibrary(userId, size, request.intents(), request.cuisines(),
                        request.exclude())
                .stream().map(BatchSuggestionController::view).toList();

        if (!own.isEmpty()) {
            return new SetsView(own, false);
        }

        // Only when the library could not form one at all. A set of the cook's
        // own recipes beats an invented one every time: they know they like
        // them, the quantities are theirs, and they cost nothing to find.
        SetView invented = fromModel(userId, size, request);
        return invented == null
                ? new SetsView(List.of(), false)
                : new SetsView(List.of(invented), true);
    }

    /**
     * One set from a model, with its sharing counted the same way.
     *
     * Declined quietly for every reason there is — no entitlement, nothing
     * wired, no budget, an answer that shares nothing after all. An empty list
     * is the honest answer to "nothing here batches together"; it is not an
     * error, and it must not become one.
     */
    private SetView fromModel(Long userId, int size, Request request) {
        MenuIntelligence reader = readers.stream()
                .filter(MenuIntelligence::available)
                .findFirst()
                .orElse(readers.get(readers.size() - 1));

        if (!entitlements.has(userId, Feature.AI_MENU) || !reader.available()) {
            return null;
        }
        try {
            budget.require(userId);
        } catch (AiBudget.ExhaustedException e) {
            return null;
        }

        try {
            MenuIntelligence.Ideas ideas = reader.suggestBatch(
                    request.intents() == null ? Set.of() : request.intents(),
                    WeekSuggestionService.knownCuisines(request.cuisines()),
                    size);
            budget.record(userId, "BATCH_SUGGESTIONS", reader.name(),
                    ideas.usage().inputTokens(), ideas.usage().outputTokens());

            if (ideas.suggestions().size() < FEWEST) {
                return null;
            }
            return describe(ideas.suggestions());
        } catch (RuntimeException e) {
            log.warn("No batch ideas came back: {}", e.toString());
            return null;
        }
    }

    /**
     * What a set of ideas actually shares.
     *
     * The same rule the library goes through, applied to lines a model wrote:
     * a set that turns out to share nothing is dropped rather than dressed up.
     * Asking for a common base and being told there is one are two different
     * things, and only the second one is checkable.
     */
    private SetView describe(List<MenuDtos.Suggestion> ideas) {
        Map<String, BaseView> shared = new LinkedHashMap<>();
        for (MenuDtos.Suggestion idea : ideas) {
            Set<String> counted = new java.util.LinkedHashSet<>();
            for (MenuDtos.Ingredient line : idea.ingredients()) {
                if (!SharedBase.carriesWork(line.unit(), line.quantity())) {
                    continue;
                }
                String key = SharedBase.keyOf(line.name(), line.unit());
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
            members.add(new MemberView(
                    null, idea.title(), idea.minutes(), null, Set.of(), false, false,
                    new WeekSuggestionController.Idea(idea.title(), idea.minutes(),
                            idea.ingredients(), idea.steps())));
        }
        return new SetView(members, bases, most);
    }

    private static SetView view(BatchSuggestionService.BatchSet set) {
        return new SetView(
                set.members().stream()
                        .map(member -> new MemberView(
                                member.recipeId(), member.title(), member.minutes(),
                                member.cuisine(), member.tags(), member.hasPhoto(),
                                member.taggedBatch(), null))
                        .toList(),
                set.bases().stream()
                        .map(base -> new BaseView(
                                base.name(), base.unit(), base.quantity(), base.dishes()))
                        .toList(),
                set.sharedBy());
    }
}
