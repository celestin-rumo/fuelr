package ch.celestin.fuelr.menu;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Whole dishes out of a stream of characters, braces in strings and all. */
class DishScannerTest {

    private static final String INPUT = """
            {"plats":[{"titre":"Dahl {épicé}","ingredients":[{"nom":"Lentilles","quantite":300,"unite":"g"}],\
            "etapes":["Cuire \\"20\\" min", "Servir ]"]},{"titre":"Soupe","ingredients":[],"etapes":[]}]}""";

    @Test
    void yieldsEachDishOnceWhateverTheFragmentsAre() {
        for (int size : new int[] {1, 3, 7, 50, INPUT.length()}) {
            DishScanner scanner = new DishScanner();
            List<String> dishes = new ArrayList<>();
            for (int at = 0; at < INPUT.length(); at += size) {
                dishes.addAll(scanner.feed(INPUT.substring(at, Math.min(INPUT.length(), at + size))));
            }
            assertThat(dishes).as("fragments of " + size).hasSize(2);
            assertThat(dishes.get(0)).startsWith("{\"titre\":\"Dahl {épicé}\"").endsWith("\"Servir ]\"]}");
            assertThat(dishes.get(1)).isEqualTo("{\"titre\":\"Soupe\",\"ingredients\":[],\"etapes\":[]}");
        }
    }

    @Test
    void aDishCutShortIsNeverYielded() {
        DishScanner scanner = new DishScanner();
        assertThat(scanner.feed("{\"plats\":[{\"titre\":\"Dahl\",\"etapes\":[\"Cuire")).isEmpty();
    }
}
