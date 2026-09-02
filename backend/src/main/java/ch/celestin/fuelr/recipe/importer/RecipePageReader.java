package ch.celestin.fuelr.recipe.importer;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Picks the parser that can read a given page.
 *
 * Spring injects every {@link RecipePageParser} in `@Order`, so adding support
 * for a site that publishes nothing standard means adding one class — no
 * registry to edit, and nothing here to change.
 */
@Service
public class RecipePageReader {

    private final List<RecipePageParser> parsers;

    public RecipePageReader(List<RecipePageParser> parsers) {
        this.parsers = parsers;
    }

    public record Reading(ParsedRecipe recipe, String parser) {
    }

    public Reading read(String html, String url) {
        Document document = Jsoup.parse(html, url == null ? "" : url);
        for (RecipePageParser parser : parsers) {
            if (parser.supports(document)) {
                ParsedRecipe parsed = parser.parse(document);
                if (!parsed.isEmpty()) {
                    return new Reading(parsed, parser.name());
                }
            }
        }
        // A page nobody can read is a normal outcome, not an error: the caller
        // offers manual entry instead of a dead end.
        return new Reading(new ParsedRecipe(), null);
    }

    /** For diagnostics: which readings this build knows about, in order. */
    public List<String> parserNames() {
        return parsers.stream().map(RecipePageParser::name).toList();
    }
}
