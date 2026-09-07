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

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Fill my week, in this direction.
 *
 * The library answers first and for free — an intention is a tag and a cuisine
 * is a column, so what somebody already wrote is a query rather than a guess.
 * A model is asked only for the slots left over, only for an account entitled
 * to it, and only while there is budget: three separate reasons to decline,
 * and every one of them ends the same way, with fewer proposals rather than an
 * error. A screen that offered to sell a plan in the middle of answering a
 * question would be reading the room badly.
 *
 * Nothing here writes to the plan. What comes back is a proposal, accepted meal
 * by meal or all at once — which is what makes correcting it possible at all.
 */
@RestController
@RequestMapping("/api/plan/suggest")
public class WeekSuggestionController {

    private static final Logger log = LoggerFactory.getLogger(WeekSuggestionController.class);

    /**
     * A ceiling on one request, whatever is asked for.
     *
     * Seven days times four slots is twenty-eight dishes, and a model asked
     * for twenty-eight is a bill nobody intended. The planner asks for dinners
     * by default; anything larger is somebody exploring, and exploring has a
     * price.
     */
    private static final int MOST_SLOTS = 14;

    public record Request(
            String week,
            Set<String> intents,
            Set<String> cuisines,
            List<String> slots,
            /** Days to leave alone: already planned, or pinned by the cook. */
            List<String> skipDays,
            /** Recipes not to propose again — refused, or already placed. */
            Set<Long> exclude) {
    }

    public record Idea(
            String title,
            Integer minutes,
            List<MenuDtos.Ingredient> ingredients,
            List<String> steps) {
    }

    public record ProposalView(
            String date,
            String slot,
            /** Null for an idea: it is not a recipe yet, and may never be. */
            Long recipeId,
            String title,
            Integer minutes,
            String cuisine,
            Set<String> tags,
            boolean hasPhoto,
            String because,
            /** Present only for an idea, so accepting can make a draft of it. */
            Idea idea) {
    }

    public record SuggestionView(
            List<ProposalView> proposals,
            int unfilled,
            /** True when a model was asked; the screen says so, as elsewhere. */
            boolean assisted) {
    }

    private final WeekSuggestionService suggestions;
    private final Entitlements entitlements;
    private final AiBudget budget;
    private final List<MenuIntelligence> readers;

    public WeekSuggestionController(WeekSuggestionService suggestions,
                                    Entitlements entitlements, AiBudget budget,
                                    List<MenuIntelligence> readers) {
        this.suggestions = suggestions;
        this.entitlements = entitlements;
        this.budget = budget;
        this.readers = readers;
    }

    @PostMapping
    public SuggestionView suggest(@AuthenticationPrincipal Jwt principal,
                                  @RequestBody Request request) {
        Long userId = Long.valueOf(principal.getSubject());

        LocalDate monday = PlanService.weekStart(LocalDate.parse(request.week()));
        Set<String> skip = request.skipDays() == null
                ? Set.of() : Set.copyOf(request.skipDays());
        List<LocalDate> days = new ArrayList<>();
        for (int day = 0; day < 7; day++) {
            LocalDate date = monday.plusDays(day);
            if (!skip.contains(date.toString())) {
                days.add(date);
            }
        }

        List<MealSlot> slots = request.slots() == null || request.slots().isEmpty()
                // Dinner, because that is the meal a week is planned around.
                ? List.of(MealSlot.DINNER)
                : request.slots().stream().map(MealSlot::valueOf).toList();

        // Trimmed rather than refused: asking for the whole week is a
        // reasonable thing to try, and answering fourteen of it beats a 400.
        while (days.size() * slots.size() > MOST_SLOTS && !days.isEmpty()) {
            days.remove(days.size() - 1);
        }

        WeekSuggestionService.Wanted wanted = new WeekSuggestionService.Wanted(
                request.intents(),
                WeekSuggestionService.knownCuisines(request.cuisines()),
                days, slots, request.exclude());

        WeekSuggestionService.Suggestion own = suggestions.fromLibrary(userId, wanted);
        List<ProposalView> proposals = new ArrayList<>(own.proposals().stream()
                .map(WeekSuggestionController::view).toList());

        boolean assisted = false;
        if (own.unfilled() > 0) {
            List<ProposalView> invented = fromModel(userId, wanted, own, proposals);
            assisted = !invented.isEmpty();
            proposals.addAll(invented);
        }

        int asked = days.size() * slots.size();
        return new SuggestionView(proposals, asked - proposals.size(), assisted);
    }

    /**
     * Ideas for the slots the library could not fill.
     *
     * Declined quietly for every reason there is — no entitlement, nothing
     * wired, no budget, an answer that came back empty. What the library found
     * still stands: half a week of the cook's own recipes is a better answer
     * than an error.
     */
    private List<ProposalView> fromModel(Long userId, WeekSuggestionService.Wanted wanted,
                                         WeekSuggestionService.Suggestion own,
                                         List<ProposalView> already) {
        MenuIntelligence reader = readers.stream()
                .filter(MenuIntelligence::available)
                .findFirst()
                .orElse(readers.get(readers.size() - 1));

        if (!entitlements.has(userId, Feature.AI_MENU) || !reader.available()) {
            return List.of();
        }
        try {
            budget.require(userId);
        } catch (AiBudget.ExhaustedException e) {
            return List.of();
        }

        try {
            MenuIntelligence.Ideas ideas = reader.suggestFor(
                    wanted.intents() == null ? Set.of() : wanted.intents(),
                    wanted.cuisines(),
                    own.unfilled(),
                    already.stream().map(ProposalView::title).toList());
            budget.record(userId, "WEEK_SUGGESTIONS", reader.name(),
                    ideas.usage().inputTokens(), ideas.usage().outputTokens());

            // Laid onto the slots the library left empty, in order.
            List<ProposalView> placed = new ArrayList<>();
            Set<String> taken = new LinkedHashSet<>();
            already.forEach(one -> taken.add(one.date() + one.slot()));

            int at = 0;
            for (LocalDate day : wanted.days()) {
                for (MealSlot slot : wanted.slots()) {
                    if (taken.contains(day + slot.name())) {
                        continue;
                    }
                    if (at >= ideas.suggestions().size()) {
                        return placed;
                    }
                    MenuDtos.Suggestion idea = ideas.suggestions().get(at++);
                    placed.add(new ProposalView(
                            day.toString(), slot.name(), null, idea.title(),
                            idea.minutes(), null, Set.of(), false, "IDEA",
                            new Idea(idea.title(), idea.minutes(),
                                    idea.ingredients(), idea.steps())));
                }
            }
            return placed;
        } catch (RuntimeException e) {
            log.warn("No week ideas came back: {}", e.toString());
            return List.of();
        }
    }

    private static ProposalView view(WeekSuggestionService.Proposal proposal) {
        return new ProposalView(
                proposal.date().toString(), proposal.slot().name(),
                proposal.recipeId(), proposal.title(), proposal.minutes(),
                proposal.cuisine(), proposal.tags(), proposal.hasPhoto(),
                proposal.because(), null);
    }
}
