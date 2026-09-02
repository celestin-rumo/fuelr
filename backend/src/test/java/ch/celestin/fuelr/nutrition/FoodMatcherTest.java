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

import static org.assertj.core.api.Assertions.assertThat;

/** The rules matching runs by, each with the case that made it necessary. */
@SpringBootTest
@Testcontainers
class FoodMatcherTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17");

    @Autowired FoodMatcher matcher;

    @Test
    void matchesWholeWordsOnly() {
        // The bug this exists for: "ail" is inside "corail", and a substring
        // search once turned a lentil dish into garlic.
        Food lentils = matcher.match("Lentilles corail").orElseThrow();
        Food garlic = matcher.match("Ail").orElseThrow();

        assertThat(lentils.getId()).isNotEqualTo(garlic.getId());
        assertThat(lentils.getKcal()).isGreaterThan(200);
    }

    @Test
    void theLongestRunOfWordsWins() {
        Food coconutMilk = matcher.match("Lait de coco").orElseThrow();
        Food milk = matcher.match("Lait entier").orElseThrow();

        // Two foods, not one: "lait de coco" must not settle for "lait".
        assertThat(coconutMilk.getId()).isNotEqualTo(milk.getId());
        assertThat(coconutMilk.getFatG()).isGreaterThan(milk.getFatG());
    }

    @Test
    void aQualifiedPublishedNameAnswersToItsPlainHead() {
        // The table says "Oignon, cru"; a cook writes "oignon".
        assertThat(matcher.match("oignon")).isPresent();
        assertThat(matcher.match("Oignon rouge")).isPresent();
    }

    @Test
    void theSameTextAlwaysGivesTheSameFood() {
        Long first = matcher.match("tomate").orElseThrow().getId();
        matcher.reload();
        Long second = matcher.match("tomate").orElseThrow().getId();

        // Nothing here may depend on the order rows come back in.
        assertThat(second).isEqualTo(first);
    }

    @Test
    void pluralsMeetSingularsInThreeLanguages() {
        assertThat(matcher.match("carottes")).isPresent();
        assertThat(matcher.match("Karotten")).isPresent();
        assertThat(matcher.match("tomatoes")).isPresent();
        assertThat(matcher.match("strawberries")).isPresent();
    }

    @Test
    void anIngredientTypedInAnyOfTheThreeLanguagesMatches() {
        assertThat(matcher.match("beurre")).isPresent();
        assertThat(matcher.match("Butter")).isPresent();
        assertThat(matcher.match("butter")).isPresent();
    }

    @Test
    void normalisingStripsAccentsCaseAndPunctuationAndOpensLigatures() {
        assertThat(FoodMatcher.normalise("Crème fraîche")).isEqualTo("creme fraiche");
        assertThat(FoodMatcher.normalise("Huile d'olive")).isEqualTo("huile d olive");
        // NFD leaves "œ" alone, so it is opened first or "œuf" loses its heart.
        assertThat(FoodMatcher.normalise("Œuf")).isEqualTo("oeuf");
        assertThat(FoodMatcher.normalise("Weissbrot/Weißbrot")).isEqualTo("weissbrot weissbrot");
    }

    /**
     * The generator writes `normalised` into the CSV; the matcher looks names
     * up by computing it again in Java. If the two rules drift, names are
     * stored in one shape and searched for in another, and nothing matches —
     * silently, because both sides still look perfectly reasonable.
     */
    @Test
    void theJavaAndPythonNormalisersAgreeOnEveryStoredName() throws Exception {
        int checked = 0;
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                new ClassPathResource("food/names.csv").getInputStream(),
                StandardCharsets.UTF_8))) {
            reader.readLine();
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) continue;
                String[] row = FoodTableImporter.split(line);
                assertThat(FoodMatcher.normalise(row[2]))
                        .as("the generator and the matcher disagree about %s", row[2])
                        .isEqualTo(row[3]);
                checked++;
            }
        }
        assertThat(checked).isGreaterThan(3000);
    }
}
