package ch.celestin.fuelr.auth;

import java.util.Map;

/**
 * Builds the links that go into emails.
 *
 * The slugs duplicate `frontend/i18n/routing.ts`, which is unfortunate but
 * deliberate: letting the caller pass the URL to embed would turn a public
 * endpoint into a way to send phishing from a Fuelr address. Adding a locale
 * there means adding it here.
 */
final class EmailLinks {

    private static final String FALLBACK_LOCALE = "fr";

    private static final Map<String, String> RESET = Map.of(
            "fr", "/nouveau-mot-de-passe",
            "en", "/reset-password",
            "de", "/neues-passwort");

    private static final Map<String, String> VERIFY_EMAIL = Map.of(
            "fr", "/verification-email",
            "en", "/verify-email",
            "de", "/email-bestaetigen");

    private EmailLinks() {
    }

    static String resetPassword(String siteUrl, String locale, String token) {
        return build(siteUrl, RESET, locale, token);
    }

    static String verifyEmail(String siteUrl, String locale, String token) {
        return build(siteUrl, VERIFY_EMAIL, locale, token);
    }

    private static String build(
            String siteUrl, Map<String, String> paths, String locale, String token) {
        String safe = paths.containsKey(locale) ? locale : FALLBACK_LOCALE;
        return "%s/%s%s?token=%s".formatted(siteUrl, safe, paths.get(safe), token);
    }
}
