package ch.celestin.fuelr.recipe.importer;

import org.jsoup.nodes.Document;

/**
 * One way of reading a recipe out of a page.
 *
 * Implementations are found by Spring and tried in {@code @Order}, so a parser
 * for a site that publishes nothing machine-readable can be added later, given
 * a low order, and will be consulted before the generic ones — without any
 * existing code learning about it.
 *
 * They are deliberately named after *formats* rather than sites: a parser that
 * understands schema.org JSON-LD reads Marmiton, Betty Bossi and most of the
 * cooking web at once, where three site-specific parsers would read three
 * pages and rot at the first redesign.
 */
public interface RecipePageParser {

    /** Cheap enough to call on every page: look, do not parse. */
    boolean supports(Document document);

    ParsedRecipe parse(Document document);

    /** For logs and for telling someone which reading produced their draft. */
    String name();
}
