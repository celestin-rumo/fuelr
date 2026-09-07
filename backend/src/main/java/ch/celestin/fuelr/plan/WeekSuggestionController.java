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
            /**
             * Slots already decided — kept from a previous answer, or already
             * planned. Per slot rather than per day, because correcting a week
             * happens one dinner at a time: keeping Tuesday must not mean
             * giving up on Tuesday lunch.
             */
            List<Taken> keep,
            /** Recipes not to propose again — refused, or already placed. */
            Set<Long> exclude,
            /**
             * Titles already seen, kept or refused.
             *
             * An idea has no id, so it can only be excluded by its name — and
             * a proposal that comes back after a refusal is the fastest way to
             * lose somebody.
             */
            Set<String> excludeTitles,
            /**
             * What somebody typed when refusing — "moins de pâtes", "quelque
             * chose de plus léger". Optional, and it only reaches the model:
             * the library matches on tags and a cuisine, and inventing a search
             * over free text would be guessing at what somebody meant.
             */
            String note) {
    }

    public record Taken(String date, String slot) {
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

        List<MealSlot> slots = request.slots() == null || request.slots().isEmpty()
                // Dinner, because that is the meal a week is planned around.
                ? List.of(MealSlot.DINNER)
                : request.slots().stream().map(MealSlot::valueOf).toList();

        Set<String> taken = request.keep() == null ? Set.of()
                : request.keep().stream().map(one -> one.date() + one.slot())
                        .collect(java.util.stream.Collectors.toSet());

        // Every slot of the week that is still open, in order.
        List<WeekSuggestionService.Slot> open = new ArrayList<>();
        for (int day = 0; day < 7 && open.size() < MOST_SLOTS; day++) {
            LocalDate date = monday.plusDays(day);
            for (MealSlot slot : slots) {
                if (!taken.contains(date + slot.name()) && open.size() < MOST_SLOTS) {
                    open.add(new WeekSuggestionService.Slot(date, slot));
                }
            }
        }

        WeekSuggestionService.Wanted wanted = new WeekSuggestionService.Wanted(
                request.intents(),
                WeekSuggestionService.knownCuisines(request.cuisines()),
                open, request.exclude(),
                request.excludeTitles() == null ? Set.of() : request.excludeTitles());

        WeekSuggestionService.Suggestion own = suggestions.fromLibrary(userId, wanted);
        List<ProposalView> proposals = new ArrayList<>(own.proposals().stream()
                .map(WeekSuggestionController::view).toList());

        boolean assisted = false;
        if (own.unfilled() > 0) {
            List<ProposalView> invented =
                    fromModel(userId, wanted, own, proposals, request.note());
            assisted = !invented.isEmpty();
            proposals.addAll(invented);
        }

        return new SuggestionView(proposals, open.size() - proposals.size(), assisted);
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
                                         List<ProposalView> already, String note) {
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
                    already.stream().map(ProposalView::title).toList(),
                    note);
            budget.record(userId, "WEEK_SUGGESTIONS", reader.name(),
                    ideas.usage().inputTokens(), ideas.usage().outputTokens());

            // Laid onto the slots the library left empty, in order.
            List<ProposalView> placed = new ArrayList<>();
            Set<String> filled = new LinkedHashSet<>();
            already.forEach(one -> filled.add(one.date() + one.slot()));

            int at = 0;
            for (WeekSuggestionService.Slot slot : wanted.slots()) {
                if (filled.contains(slot.date() + slot.slot().name())) {
                    continue;
                }
                if (at >= ideas.suggestions().size()) {
                    return placed;
                }
                MenuDtos.Suggestion idea = ideas.suggestions().get(at++);
                placed.add(new ProposalView(
                        slot.date().toString(), slot.slot().name(), null, idea.title(),
                        idea.minutes(), null, Set.of(), false, "IDEA",
                        new Idea(idea.title(), idea.minutes(),
                                idea.ingredients(), idea.steps())));
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
