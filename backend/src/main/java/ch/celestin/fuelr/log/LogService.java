package ch.celestin.fuelr.log;

import ch.celestin.fuelr.log.LogDtos.DayTotals;
import ch.celestin.fuelr.log.LogDtos.EntryView;
import ch.celestin.fuelr.log.LogDtos.HistoryView;
import ch.celestin.fuelr.log.LogDtos.Insight;
import ch.celestin.fuelr.log.LogDtos.LogRequest;
import ch.celestin.fuelr.log.LogDtos.Targets;
import ch.celestin.fuelr.log.LogDtos.WeekView;
import ch.celestin.fuelr.nutrition.NutritionDtos;
import ch.celestin.fuelr.nutrition.NutritionService;
import ch.celestin.fuelr.profile.NutritionTargetService;
import ch.celestin.fuelr.profile.Profile;
import ch.celestin.fuelr.profile.ProfileRepository;
import ch.celestin.fuelr.recipe.Recipe;
import ch.celestin.fuelr.recipe.RecipeService;
import ch.celestin.fuelr.subscription.Entitlements;
import ch.celestin.fuelr.subscription.Feature;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * What was eaten, and what it is measured against.
 *
 * Every entry copies its figures in. Nothing here reads a recipe back: recipes
 * are corrected after they have been cooked, and a history that followed them
 * would rewrite what somebody ate in March because they fixed a typo in June.
 */
@Service
public class LogService {

    /** How far back the free plan looks. Beyond it is what the paid plan opens. */
    public static final int FREE_WINDOW_DAYS = 30;

    private static final int DAYS_IN_WEEK = 7;

    public static class UnknownRecipeException extends RuntimeException {
        public UnknownRecipeException() {
            super("unknown_recipe");
        }
    }

    private final MealLogRepository entries;
    private final NutritionTargetRepository targets;
    private final ProfileRepository profiles;
    private final NutritionTargetService computedTargets;
    private final RecipeService recipes;
    private final NutritionService nutrition;
    private final Entitlements entitlements;

    public LogService(MealLogRepository entries, NutritionTargetRepository targets,
                      ProfileRepository profiles, NutritionTargetService computedTargets,
                      RecipeService recipes, NutritionService nutrition,
                      Entitlements entitlements) {
        this.entries = entries;
        this.targets = targets;
        this.profiles = profiles;
        this.computedTargets = computedTargets;
        this.recipes = recipes;
        this.nutrition = nutrition;
        this.entitlements = entitlements;
    }

    public static LocalDate weekStart(LocalDate anyDay) {
        return anyDay.with(DayOfWeek.MONDAY);
    }

    // --- writing ------------------------------------------------------------

    /**
     * Logs a meal.
     *
     * With a recipe id the figures are computed from that recipe once, now,
     * and stored. Without one they are whatever was typed — which is the
     * point of the story: a meal at a restaurant has no recipe and should not
     * need one invented for it.
     */
    @Transactional
    public MealLogEntry log(Long userId, LogRequest request) {
        if (request.recipeId() != null) {
            Recipe recipe = recipes.find(request.recipeId(), userId)
                    .orElseThrow(UnknownRecipeException::new);
            double servings = request.servings() == null ? 1 : request.servings();
            NutritionDtos.Breakdown breakdown = nutrition.compute(
                    recipe.getIngredients().stream()
                            .map(i -> new NutritionDtos.IngredientInput(
                                    i.getName(), i.getQuantity().doubleValue(), i.getUnit()))
                            .toList(),
                    Math.max(1, recipe.getServings()));

            MealLogEntry entry = new MealLogEntry(
                    userId,
                    request.title() != null && !request.title().isBlank()
                            ? request.title().trim()
                            : String.valueOf(recipe.getTitle()),
                    request.date(), slotOf(request.slot()), BigDecimal.valueOf(servings),
                    scaled(breakdown.perServing().kcal(), servings),
                    scaled(breakdown.perServing().proteinG(), servings),
                    scaled(breakdown.perServing().carbsG(), servings),
                    scaled(breakdown.perServing().fatG(), servings),
                    breakdown.containsEstimates(), MealLogEntry.Source.RECIPE);
            entry.from(recipe.getId(), null);
            return entries.save(entry);
        }

        String title = request.title() == null ? "" : request.title().trim();
        if (title.isEmpty()) {
            throw new IllegalArgumentException("title_required");
        }
        double servings = request.servings() == null ? 1 : request.servings();
        MealLogEntry entry = new MealLogEntry(
                userId, title, request.date(), slotOf(request.slot()),
                BigDecimal.valueOf(servings),
                BigDecimal.valueOf(orZero(request.kcal())),
                BigDecimal.valueOf(orZero(request.proteinG())),
                BigDecimal.valueOf(orZero(request.carbsG())),
                BigDecimal.valueOf(orZero(request.fatG())),
                // Typed by hand, so it is a person's estimate by definition.
                true, MealLogEntry.Source.FREE);
        return entries.save(entry);
    }

    /**
     * Records a planned meal that was cooked, once.
     *
     * Marking the same evening cooked twice is a click, not a second dinner —
     * a unique index on (user, planned meal) says so in the database, and this
     * checks first so it is not an error either.
     */
    @Transactional
    public Optional<MealLogEntry> logCooked(Long userId, Long plannedMealId, Long recipeId,
                                            String title, LocalDate date, String slot,
                                            int servings,
                                            List<NutritionDtos.IngredientInput> ingredients,
                                            int recipeServings) {
        if (userId == null || entries.findByUserIdAndPlannedMealId(userId, plannedMealId).isPresent()) {
            return Optional.empty();
        }
        NutritionDtos.Breakdown breakdown = nutrition.compute(
                ingredients, Math.max(1, recipeServings));

        MealLogEntry entry = new MealLogEntry(
                userId, title == null || title.isBlank() ? "—" : title, date, slot,
                BigDecimal.valueOf(servings),
                scaled(breakdown.perServing().kcal(), servings),
                scaled(breakdown.perServing().proteinG(), servings),
                scaled(breakdown.perServing().carbsG(), servings),
                scaled(breakdown.perServing().fatG(), servings),
                breakdown.containsEstimates(), MealLogEntry.Source.PLAN);
        entry.from(recipeId, plannedMealId);
        return Optional.of(entries.save(entry));
    }

    /**
     * Puts a deleted entry back, figure for figure.
     *
     * The link to a planned meal comes back with it, so the evening stays
     * marked cooked — unless something has been logged against that meal in
     * the meantime, in which case the row still returns and only the link is
     * dropped. A unique index guards the pair, and an undo is not the place
     * to meet it.
     */
    @Transactional
    public MealLogEntry restore(Long userId, LogDtos.RestoreRequest request) {
        String title = request.title().trim();
        if (title.isEmpty()) {
            throw new IllegalArgumentException("title_required");
        }
        MealLogEntry entry = new MealLogEntry(
                userId, title, request.date(), slotOf(request.slot()),
                BigDecimal.valueOf(request.servings() == null ? 1 : request.servings()),
                BigDecimal.valueOf(orZero(request.kcal())),
                BigDecimal.valueOf(orZero(request.proteinG())),
                BigDecimal.valueOf(orZero(request.carbsG())),
                BigDecimal.valueOf(orZero(request.fatG())),
                request.estimated(), sourceOf(request.source()));
        Long plannedMealId = request.plannedMealId();
        if (plannedMealId != null
                && entries.findByUserIdAndPlannedMealId(userId, plannedMealId).isPresent()) {
            plannedMealId = null;
        }
        entry.from(request.recipeId(), plannedMealId);
        return entries.save(entry);
    }

    @Transactional
    public boolean remove(Long userId, Long id) {
        return entries.findByIdAndUserId(id, userId)
                .map(entry -> {
                    entries.delete(entry);
                    return true;
                })
                .orElse(false);
    }

    // --- targets ------------------------------------------------------------

    /**
     * What somebody is aiming for: their own figures if they set any, and
     * otherwise the ones their profile computes. Null when neither exists,
     * which is a real state and not an error — nobody has said anything yet.
     */
    public Targets targetsOf(Long userId) {
        Optional<NutritionTarget> chosen = targets.findByUserId(userId);
        if (chosen.isPresent()) {
            NutritionTarget target = chosen.get();
            return new Targets(target.getKcal(), target.getProteinG(),
                    target.getCarbsG(), target.getFatG(), true);
        }
        return profiles.findByUserId(userId)
                .map(Profile::toInput)
                .map(computedTargets::compute)
                .map(computed -> new Targets(computed.kcal(), computed.proteinG(),
                        computed.carbsG(), computed.fatG(), false))
                .orElse(null);
    }

    @Transactional
    public Targets setTargets(Long userId, LogDtos.TargetRequest request) {
        NutritionTarget target = targets.findByUserId(userId)
                .map(existing -> {
                    existing.set(request.kcal(), request.proteinG(),
                            request.carbsG(), request.fatG());
                    return existing;
                })
                .orElseGet(() -> new NutritionTarget(userId, request.kcal(),
                        request.proteinG(), request.carbsG(), request.fatG()));
        targets.save(target);
        return new Targets(target.getKcal(), target.getProteinG(),
                target.getCarbsG(), target.getFatG(), true);
    }

    // --- reading ------------------------------------------------------------

    public WeekView week(Long userId, LocalDate anyDay) {
        LocalDate start = weekStart(anyDay);
        LocalDate end = start.plusDays(DAYS_IN_WEEK - 1L);
        List<MealLogEntry> logged =
                entries.findByUserIdAndDateBetweenOrderByDateAscIdAsc(userId, start, end);

        List<DayTotals> days = totals(start, DAYS_IN_WEEK, logged);
        int loggedDays = (int) days.stream().filter(DayTotals::logged).count();
        DayTotals average = average(days, loggedDays);

        // Logging is free; measuring yourself against a target is not.
        boolean tracking = entitlements.has(userId, Feature.NUTRITION_TRACKING);
        Targets targets = tracking ? targetsOf(userId) : null;

        return new WeekView(
                start, days, logged.stream().map(LogService::toView).toList(),
                average, loggedDays, targets,
                tracking ? insights(days, average, loggedDays, targets) : List.of(),
                tracking);
    }

    /**
     * Day totals over a range, with the free plan's window applied.
     *
     * The window is a clamp on the start date, not a filter on the rows: the
     * data is all still there, and it comes back the moment the plan does.
     * That is what "cancelling loses nothing" has to mean here.
     */
    public HistoryView history(Long userId, LocalDate from, LocalDate to) {
        LocalDate today = LocalDate.now();
        LocalDate end = to == null ? today : to;
        LocalDate requested = from == null ? end.minusDays(89) : from;

        boolean unlimited = entitlements.has(userId, Feature.FULL_HISTORY);
        LocalDate earliestAllowed = today.minusDays(FREE_WINDOW_DAYS - 1L);
        boolean windowed = !unlimited && requested.isBefore(earliestAllowed);
        LocalDate start = windowed ? earliestAllowed : requested;

        List<MealLogEntry> logged =
                entries.findByUserIdAndDateBetweenOrderByDateAscIdAsc(userId, start, end);
        int span = (int) java.time.temporal.ChronoUnit.DAYS.between(start, end) + 1;

        return new HistoryView(
                start, end, windowed, FREE_WINDOW_DAYS,
                entries.findFirstByUserIdOrderByDateAsc(userId)
                        .map(MealLogEntry::getDate).orElse(null),
                totals(start, Math.max(span, 0), logged));
    }

    // --- internals ----------------------------------------------------------

    private static List<DayTotals> totals(LocalDate start, int days, List<MealLogEntry> logged) {
        Map<LocalDate, List<MealLogEntry>> byDay = new LinkedHashMap<>();
        for (MealLogEntry entry : logged) {
            byDay.computeIfAbsent(entry.getDate(), ignored -> new ArrayList<>()).add(entry);
        }

        List<DayTotals> result = new ArrayList<>();
        for (int i = 0; i < days; i++) {
            LocalDate day = start.plusDays(i);
            List<MealLogEntry> onDay = byDay.getOrDefault(day, List.of());
            result.add(new DayTotals(
                    day, !onDay.isEmpty(), onDay.size(),
                    round(onDay.stream().mapToDouble(MealLogEntry::getKcal).sum()),
                    round(onDay.stream().mapToDouble(MealLogEntry::getProteinG).sum()),
                    round(onDay.stream().mapToDouble(MealLogEntry::getCarbsG).sum()),
                    round(onDay.stream().mapToDouble(MealLogEntry::getFatG).sum()),
                    onDay.stream().anyMatch(MealLogEntry::isEstimated)));
        }
        return result;
    }

    /** Averaged over the days that were logged. A blank day is not a zero. */
    private static DayTotals average(List<DayTotals> days, int loggedDays) {
        if (loggedDays == 0) {
            return new DayTotals(null, false, 0, 0, 0, 0, 0, false);
        }
        return new DayTotals(
                null, true,
                days.stream().mapToInt(DayTotals::meals).sum(),
                round(days.stream().mapToDouble(DayTotals::kcal).sum() / loggedDays),
                round(days.stream().mapToDouble(DayTotals::proteinG).sum() / loggedDays),
                round(days.stream().mapToDouble(DayTotals::carbsG).sum() / loggedDays),
                round(days.stream().mapToDouble(DayTotals::fatG).sum() / loggedDays),
                days.stream().anyMatch(DayTotals::estimated));
    }

    /**
     * One finding per chart, and never a scolding.
     *
     * These are codes and numbers; the words are in the message catalogues.
     * The rules are deliberately dull — a gap against a target, a macro that
     * is short, a week that was only half written down — and there is no
     * streak, no badge, and nothing that congratulates or blames. A food diary
     * that makes people feel watched stops being written in, and then it
     * measures nothing at all.
     */
    private static List<Insight> insights(List<DayTotals> days, DayTotals average,
                                          int loggedDays, Targets targets) {
        List<Insight> found = new ArrayList<>();
        if (loggedDays == 0) {
            found.add(new Insight("NOTHING_LOGGED", Map.of()));
            return found;
        }

        // Said first, because every other figure on the screen depends on it.
        if (loggedDays < days.size()) {
            found.add(new Insight("PARTIAL_WEEK", Map.of(
                    "logged", (double) loggedDays, "days", (double) days.size())));
        }

        if (targets != null && targets.kcal() > 0) {
            double gap = average.kcal() - targets.kcal();
            found.add(new Insight("ENERGY_VS_TARGET", Map.of(
                    "average", average.kcal(),
                    "target", (double) targets.kcal(),
                    "gap", round(gap),
                    "gapPercent", round(gap / targets.kcal() * 100))));

            if (targets.proteinG() > 0 && average.proteinG() < targets.proteinG() * 0.9) {
                found.add(new Insight("PROTEIN_BELOW_TARGET", Map.of(
                        "average", average.proteinG(),
                        "target", (double) targets.proteinG(),
                        "gap", round(targets.proteinG() - average.proteinG()))));
            }
        }

        if (days.stream().anyMatch(DayTotals::estimated)) {
            found.add(new Insight("CONTAINS_ESTIMATES", Map.of()));
        }
        return found;
    }

    private static EntryView toView(MealLogEntry entry) {
        return new EntryView(
                entry.getId(), entry.getDate(), entry.getSlot(), entry.getTitle(),
                entry.getServings(), entry.getKcal(), entry.getProteinG(),
                entry.getCarbsG(), entry.getFatG(), entry.isEstimated(),
                entry.getSource().name(), entry.getRecipeId(), entry.getPlannedMealId());
    }

    /** An unknown source is a free entry: the label is not worth a 400. */
    private static MealLogEntry.Source sourceOf(String source) {
        if (source == null) return MealLogEntry.Source.FREE;
        try {
            return MealLogEntry.Source.valueOf(source.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return MealLogEntry.Source.FREE;
        }
    }

    private static String slotOf(String slot) {
        return slot == null || slot.isBlank() ? "OTHER" : slot.trim().toUpperCase();
    }

    private static BigDecimal scaled(double perServing, double servings) {
        return BigDecimal.valueOf(round(perServing * servings));
    }

    private static double orZero(Double value) {
        return value == null ? 0 : value;
    }

    private static double round(double value) {
        return Math.round(value * 10d) / 10d;
    }
}
