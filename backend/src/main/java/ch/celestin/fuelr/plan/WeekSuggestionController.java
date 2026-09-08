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

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Fill my week with dishes nobody has written yet.
 *
 * **This one invents; it never proposes something already in the library.**
 * That is a product decision and the opposite of what the screen next door
 * does: `MenuSuggestionService` answers "what do I cook with this bag" and
 * searches the cook's own recipes first, because they know they like them.
 * Filling a week is the other question — somebody wants dishes they have not
 * had, and handing back the four recipes they wrote last month is not an
 * answer to it.
 *
 * Two consequences, and both are deliberate. Every fill costs money, so the
 * budget is what bounds this rather than the library. And when a model cannot
 * answer — no entitlement, nothing wired, a spent month, a call that failed —
 * there is no second source: the screen is told **which** of those it is and
 * says so, instead of quietly handing back fewer proposals it never had.
 *
 * Nothing here writes to the plan. What comes back is a proposal, accepted
 * meal by meal, and accepting one writes a draft marked as a model's work.
 */
@RestController
@RequestMapping("/api/plan/suggest")
public class WeekSuggestionController {

    private static final Logger log = LoggerFactory.getLogger(WeekSuggestionController.class);

    /**
     * A ceiling on one request, whatever is asked for.
     *
     * Seven days times four slots is twenty-eight dishes, and every one of them
     * is now billed. The planner asks for dinners by default; anything larger
     * is somebody exploring, and exploring has a price.
     */
    private static final int MOST_SLOTS = 14;

    /**
     * Why nothing came back, when nothing came back.
     *
     * Named apart because they are different conversations: {@code PLAN} is
     * answered by subscribing, {@code BUDGET} by waiting for the month to
     * turn, {@code UNAVAILABLE} only by us. The same distinction
     * `/api/recipes/import/sources` already makes, and for the same reason — a
     * screen that refuses without saying which of these it is teaches somebody
     * to stop pressing the button.
     */
    public enum Declined { NONE, PLAN, BUDGET, UNAVAILABLE, FAILED }

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
            /**
             * Titles already seen, kept or refused.
             *
             * Everything here is an idea and an idea has no id, so a name is
             * the only way to say "not that one again" — and a dish that comes
             * back after a refusal is the fastest way to lose somebody.
             */
            Set<String> excludeTitles,
            /** What somebody typed when refusing. Optional; it reaches a model. */
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
            String title,
            Integer minutes,
            /** Everything it takes to become a draft, without a second bill. */
            Idea idea,
            /** The picture being drawn for it, by key; null when none will be. */
            String illustrationKey) {
    }

    public record SuggestionView(
            List<ProposalView> proposals,
            /** Slots asked about that came back empty. Not an error. */
            int unfilled,
            /** NONE while proposals came back; otherwise why they did not. */
            String declined) {
    }

    private final Entitlements entitlements;
    private final AiBudget budget;
    private final List<MenuIntelligence> readers;
    private final ch.celestin.fuelr.preferences.DietaryPreferencesRepository preferences;
    private final IdeaStreams streams;
    private final IllustrationService illustrations;

    public WeekSuggestionController(Entitlements entitlements, AiBudget budget,
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
    public SuggestionView suggest(@AuthenticationPrincipal Jwt principal,
                                  @RequestBody Request request) {
        return answer(Long.valueOf(principal.getSubject()), request, MenuIntelligence.Progress.NONE);
    }

    /**
     * The same answer, told as it is written.
     *
     * Fourteen dinners take a model about two minutes, and two minutes of
     * spinner reads as a hang. This streams a `progress` event as each
     * dish's title closes and then the whole answer as `result` — the very
     * object the endpoint above returns, so nothing is decided differently
     * for having been watched.
     */
    @PostMapping("/live")
    public SseEmitter live(@AuthenticationPrincipal Jwt principal, @RequestBody Request request) {
        Long userId = Long.valueOf(principal.getSubject());
        return streams.run(progress -> answer(userId, request, progress));
    }

    SuggestionView answer(Long userId, Request request, MenuIntelligence.Progress progress) {
        LocalDate monday = PlanService.weekStart(LocalDate.parse(request.week()));

        List<MealSlot> slots = request.slots() == null || request.slots().isEmpty()
                // Dinner, because that is the meal a week is planned around.
                ? List.of(MealSlot.DINNER)
                : request.slots().stream().map(MealSlot::valueOf).toList();

        Set<String> taken = request.keep() == null ? Set.of()
                : request.keep().stream().map(one -> one.date() + one.slot())
                        .collect(java.util.stream.Collectors.toSet());

        // Every slot of the week that is still open, in order.
        List<Slot> open = new ArrayList<>();
        for (int day = 0; day < 7 && open.size() < MOST_SLOTS; day++) {
            LocalDate date = monday.plusDays(day);
            for (MealSlot slot : slots) {
                if (!taken.contains(date + slot.name()) && open.size() < MOST_SLOTS) {
                    open.add(new Slot(date, slot));
                }
            }
        }
        // A week with nothing left to fill is answered, not refused: there is
        // no reason to spend a request finding that out.
        if (open.isEmpty()) {
            return new SuggestionView(List.of(), 0, Declined.NONE.name());
        }

        MenuIntelligence reader = readers.stream()
                .filter(MenuIntelligence::available)
                .findFirst()
                .orElse(readers.get(readers.size() - 1));

        if (!entitlements.has(userId, Feature.AI_MENU)) {
            return nothing(open.size(), Declined.PLAN);
        }
        if (!reader.available()) {
            return nothing(open.size(), Declined.UNAVAILABLE);
        }
        try {
            budget.require(userId);
        } catch (AiBudget.ExhaustedException e) {
            return nothing(open.size(), Declined.BUDGET);
        }

        ch.celestin.fuelr.preferences.Constraints constraints =
                ch.celestin.fuelr.preferences.Constraints.of(preferences.findById(userId).orElse(null));
        // As each title closes, its picture starts — while the model is
        // still writing the next dish — so most are on screen with the answer.
        boolean drawing = illustrations.available();
        MenuIntelligence.Progress told = (index, of, title) -> {
            if (drawing) {
                illustrations.illustrateIdea(userId, title);
            }
            progress.dish(index, of, title);
        };
        try {
            MenuIntelligence.Ideas ideas = reader.suggestFor(
                    request.intents() == null ? Set.of() : request.intents(),
                    Cuisine.knownNames(request.cuisines()),
                    open.size(),
                    request.excludeTitles() == null
                            ? List.of() : List.copyOf(request.excludeTitles()),
                    request.note(), constraints, told);
            budget.record(userId, "WEEK_SUGGESTIONS", reader.name(),
                    ideas.usage().inputTokens(), ideas.usage().outputTokens());

            // Asked of the model, and checked by the code: a dish that names an
            // allergen in its own ingredient lines is dropped here, whatever
            // the model was told. An allergy filtered by the model alone is
            // not filtered.
            List<MenuDtos.Suggestion> safe = ideas.suggestions().stream()
                    .filter(idea -> constraints.allows(
                            idea.ingredients().stream().map(MenuDtos.Ingredient::name).toList()))
                    .toList();
            List<ProposalView> placed = new ArrayList<>();
            for (int at = 0; at < open.size() && at < safe.size(); at++) {
                MenuDtos.Suggestion idea = safe.get(at);
                Slot slot = open.get(at);
                placed.add(new ProposalView(
                        slot.date().toString(), slot.slot().name(),
                        idea.title(), idea.minutes(),
                        new Idea(idea.title(), idea.minutes(),
                                idea.ingredients(), idea.steps()),
                        drawing ? IllustrationService.keyOf(idea.title()) : null));
            }
            // Fewer dishes than slots is an answer rather than a failure; it
            // is only a refusal when there were none at all.
            return new SuggestionView(placed, open.size() - placed.size(),
                    (placed.isEmpty() ? Declined.FAILED : Declined.NONE).name());
        } catch (RuntimeException e) {
            log.warn("No week ideas came back: {}", e.toString());
            return nothing(open.size(), Declined.FAILED);
        }
    }

    private SuggestionView nothing(int slots, Declined why) {
        return new SuggestionView(List.of(), slots, why.name());
    }

    /** One place on the week that still wants a dish. */
    record Slot(LocalDate date, MealSlot slot) {
    }
}
