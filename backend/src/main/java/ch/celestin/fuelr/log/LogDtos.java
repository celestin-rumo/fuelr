package ch.celestin.fuelr.log;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.time.LocalDate;
import java.util.List;

public final class LogDtos {

    private LogDtos() {
    }

    public record EntryView(
            Long id, LocalDate date, String slot, String title, double servings,
            double kcal, double proteinG, double carbsG, double fatG,
            boolean estimated, String source, Long recipeId, Long plannedMealId) {
    }

    /**
     * One day's total. {@code logged} says whether anything was written down
     * at all — a day with nothing logged is not a day of eating nothing, and
     * an average that treated it as zero would be a lie in the flattering
     * direction.
     */
    public record DayTotals(
            LocalDate date, boolean logged, int meals,
            double kcal, double proteinG, double carbsG, double fatG,
            boolean estimated) {
    }

    /**
     * {@code chosen} is false while these are the figures computed from the
     * profile. A target nobody picked is a suggestion, and the screen says so
     * rather than presenting arithmetic as somebody's decision.
     */
    public record Targets(int kcal, int proteinG, int carbsG, int fatG, boolean chosen) {
    }

    /**
     * One finding, as a code and its numbers.
     *
     * The wording lives in the message catalogues, not here: it has to exist
     * in three languages, and it is the part that decides whether this reads
     * as help or as a scolding. The backend supplies what is true; the screen
     * decides how to say it.
     */
    public record Insight(String code, java.util.Map<String, Double> values) {
    }

    public record WeekView(
            LocalDate weekStart,
            List<DayTotals> days,
            List<EntryView> entries,
            /** Averaged over the days that were logged, never over seven. */
            DayTotals average,
            int loggedDays,
            /** Null until the plan that includes targets is paid for. */
            Targets targets,
            List<Insight> insights,
            boolean tracking) {
    }

    public record HistoryView(
            LocalDate from,
            LocalDate to,
            /** The free plan keeps a sliding window; this says it was applied. */
            boolean windowed,
            int windowDays,
            LocalDate earliest,
            List<DayTotals> days) {
    }

    /**
     * A free entry, or a recipe eaten. {@code recipeId} decides which: with it,
     * the figures are copied from that recipe; without it, they are the ones
     * typed in — which is what "a meal at a restaurant" means.
     */
    public record LogRequest(
            @NotNull LocalDate date,
            String slot,
            String title,
            Long recipeId,
            @Min(1) Double servings,
            @PositiveOrZero Double kcal,
            @PositiveOrZero Double proteinG,
            @PositiveOrZero Double carbsG,
            @PositiveOrZero Double fatG) {
    }

    /**
     * An entry put back exactly as it was.
     *
     * Not a {@link LogRequest} with the same fields: that one recomputes from
     * the recipe when it is given one, and a restore that recomputed would
     * hand back different figures than the ones deleted the moment the recipe
     * had been edited since. Undo means "as it was", so every figure travels
     * and nothing is derived.
     */
    public record RestoreRequest(
            @NotNull LocalDate date,
            String slot,
            @NotNull String title,
            Long recipeId,
            Long plannedMealId,
            @Min(1) Double servings,
            @PositiveOrZero Double kcal,
            @PositiveOrZero Double proteinG,
            @PositiveOrZero Double carbsG,
            @PositiveOrZero Double fatG,
            boolean estimated,
            String source) {
    }

    public record TargetRequest(
            @Min(500) int kcal,
            @Min(0) int proteinG,
            @Min(0) int carbsG,
            @Min(0) int fatG) {
    }
}
