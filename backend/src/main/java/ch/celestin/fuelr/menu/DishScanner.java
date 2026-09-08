package ch.celestin.fuelr.menu;

import java.util.ArrayList;
import java.util.List;

/**
 * Finds whole dishes in the tool's input as it arrives.
 *
 * The input is `{"plats":[{...},{...}]}` written a few characters at a time.
 * A dish is an object opened at depth three — root object, `plats` array,
 * dish — and closed back to depth two; every brace inside a string is a
 * character, not structure, so strings and their escapes are tracked. The
 * text of each closed dish is handed out once, to be read like any other.
 *
 * Nothing here trusts the shape: a stream that never opens `plats` yields
 * nothing, and a dish cut short is never yielded at all.
 */
final class DishScanner {

    private final StringBuilder text = new StringBuilder();
    private int scanned = 0;
    private int depth = 0;
    private boolean inString = false;
    private boolean escaped = false;
    private int dishStart = -1;

    /** Appends a fragment and returns the dishes it completed, in order. */
    List<String> feed(String fragment) {
        text.append(fragment);
        List<String> completed = new ArrayList<>();
        for (; scanned < text.length(); scanned++) {
            char c = text.charAt(scanned);
            if (inString) {
                if (escaped) {
                    escaped = false;
                } else if (c == '\\') {
                    escaped = true;
                } else if (c == '"') {
                    inString = false;
                }
                continue;
            }
            switch (c) {
                case '"' -> inString = true;
                case '{', '[' -> {
                    depth++;
                    if (c == '{' && depth == 3) {
                        dishStart = scanned;
                    }
                }
                case '}', ']' -> {
                    if (c == '}' && depth == 3 && dishStart >= 0) {
                        completed.add(text.substring(dishStart, scanned + 1));
                        dishStart = -1;
                    }
                    depth--;
                }
                default -> { }
            }
        }
        return completed;
    }
}
