package ch.celestin.fuelr.auth;

import java.util.Locale;

/**
 * A user agent, said in words a person recognises.
 *
 * "Chrome · Android" is something you can match to the phone in your hand;
 * the 120-character string it came from is not. Deliberately coarse — the
 * browser family and the platform — because the point is recognising your own
 * devices, not fingerprinting them, and nothing more is stored for it.
 */
public final class DeviceLabel {

    private DeviceLabel() {
    }

    public static String describe(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) {
            return null;
        }
        String ua = userAgent.toLowerCase(Locale.ROOT);
        String browser =
                ua.contains("edg/") ? "Edge"
                : ua.contains("firefox/") ? "Firefox"
                : ua.contains("chrome/") || ua.contains("crios/") ? "Chrome"
                : ua.contains("safari/") ? "Safari"
                : ua.contains("playwright") || ua.contains("headless") ? "Navigateur de test"
                : null;
        String platform =
                ua.contains("iphone") || ua.contains("ipad") ? "iOS"
                : ua.contains("android") ? "Android"
                : ua.contains("windows") ? "Windows"
                : ua.contains("mac os") || ua.contains("macintosh") ? "macOS"
                : ua.contains("linux") ? "Linux"
                : null;
        if (browser == null && platform == null) {
            return null;
        }
        return browser == null ? platform : platform == null ? browser : browser + " · " + platform;
    }
}
