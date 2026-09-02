package ch.celestin.fuelr.nutrition;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.core.io.ClassPathResource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * How often the reference table actually recognises what a cook writes.
 *
 * The number this asserts is the whole point of importing a published table:
 * with two dozen hand-written rows almost everything fell through to a flat
 * guess, and every figure in this epic was arithmetic on that guess. The
 * fallback is not gone — no table covers a brand or a grandmother's
 * preparation — but it has to be rare and it has to be visible.
 */
@SpringBootTest
@Testcontainers
class FoodMatchingCorpusTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17");

    /** The bar the story sets. Raising it later is a good sign, not a chore. */
    private static final double REQUIRED = 0.90;

    @Autowired FoodMatcher matcher;

    @Test
    void ninetyPercentOfRealIngredientsResolveToARealFood() throws Exception {
        List<String> corpus = corpus();
        assertThat(corpus)
                .as("the corpus is the evidence; a small one proves nothing")
                .hasSizeGreaterThanOrEqualTo(200);

        List<String> missed = new ArrayList<>();
        for (String ingredient : corpus) {
            if (matcher.match(ingredient).isEmpty()) {
                missed.add(ingredient);
            }
        }

        double matched = (corpus.size() - missed.size()) / (double) corpus.size();
        // Printed on the way past, not only on the way down: the number is the
        // thing to watch when the table or the matcher changes.
        System.out.printf("food matching: %.1f%% of %d ingredients (%d on the fallback: %s)%n",
                matched * 100, corpus.size(), missed.size(), missed);
        assertThat(matched)
                .as("matched %d of %d; the fallback caught: %s",
                        corpus.size() - missed.size(), corpus.size(), missed)
                .isGreaterThanOrEqualTo(REQUIRED);
    }

    @Test
    void theFallbackStillExistsForWhatNoTableCovers() {
        // Not a gap to be closed: a brand nobody publishes composition for.
        assertThat(matcher.match("Zoubidou 3000")).isEmpty();
    }

    private static List<String> corpus() throws Exception {
        List<String> lines = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                new ClassPathResource("food/ingredient-corpus.txt").getInputStream(),
                StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String trimmed = line.trim();
                if (!trimmed.isEmpty() && !trimmed.startsWith("#")) {
                    lines.add(trimmed);
                }
            }
        }
        return lines;
    }
}
