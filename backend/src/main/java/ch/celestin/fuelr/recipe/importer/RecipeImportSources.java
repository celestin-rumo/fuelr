package ch.celestin.fuelr.recipe.importer;

import ch.celestin.fuelr.subscription.Entitlements;
import ch.celestin.fuelr.subscription.Feature;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * What this account may import from, right now.
 *
 * The screen asks once and offers accordingly, instead of showing three
 * buttons and refusing two of them after the fact. That is the acceptance
 * criterion of its own story — no AI feature is presented as available and
 * then refused — and it is the same rule the plan already follows with
 * {@code canOrder}.
 *
 * The two reasons a source is closed are told apart, because they are two
 * different conversations: {@code plan} is answered by subscribing, and
 * {@code soon} is answered by us and by nobody else.
 */
@Service
public class RecipeImportSources {

    public enum Availability {
        /** Usable now. */
        OPEN,
        /** Behind a paid plan this account does not have. */
        PLAN,
        /** Nothing is wired yet, so nobody can use it, paid or not. */
        SOON
    }

    public record SourceView(String source, String state, String requiredTier) {
    }

    /**
     * The sources, and whether nothing is being charged for them yet.
     *
     * The screen needs both in one answer: which doors are open, and whether
     * to say out loud that an open one will not always be free.
     */
    public record SourcesView(boolean openPeriod, List<SourceView> sources) {
    }

    private final Entitlements entitlements;
    private final List<RecipeIntelligence> readers;

    public RecipeImportSources(Entitlements entitlements, List<RecipeIntelligence> readers) {
        this.entitlements = entitlements;
        this.readers = readers;
    }

    /** The reader in use, which today is the one that reads nothing. */
    public RecipeIntelligence reader() {
        return readers.stream()
                .filter(RecipeIntelligence::available)
                .findFirst()
                .orElse(readers.get(readers.size() - 1));
    }

    public SourcesView forUser(Long userId) {
        // A link needs no model and no plan: it is the free import, and it
        // stays the fallback the other two point at when they cannot help.
        List<SourceView> sources = new java.util.ArrayList<>();
        sources.add(new SourceView("URL", Availability.OPEN.name(), null));

        Availability aided = aided(userId);
        for (RecipeIntelligence.Source source : RecipeIntelligence.Source.values()) {
            sources.add(new SourceView(
                    source.name(),
                    aided.name(),
                    aided == Availability.PLAN ? Feature.AI_IMPORT.required().name() : null));
        }
        return new SourcesView(entitlements.openPeriod(), sources);
    }

    /**
     * Whether the assisted sources can be offered.
     *
     * The plan is asked about first: somebody who has not subscribed should be
     * told what it costs, not that the feature is coming. Only once they could
     * use it does "not wired yet" become the honest answer.
     */
    private Availability aided(Long userId) {
        if (!entitlements.has(userId, Feature.AI_IMPORT)) {
            return Availability.PLAN;
        }
        return reader().available() ? Availability.OPEN : Availability.SOON;
    }
}
