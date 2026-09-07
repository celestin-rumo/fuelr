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
public final class EmailLinks {

    private static final String FALLBACK_LOCALE = "fr";

    private static final Map<String, String> RESET = Map.of(
            "fr", "/nouveau-mot-de-passe",
            "en", "/reset-password",
            "de", "/neues-passwort");

    private static final Map<String, String> VERIFY_EMAIL = Map.of(
            "fr", "/verification-email",
            "en", "/verify-email",
            "de", "/email-bestaetigen");

    /**
     * The household screen, which reads the token out of the query and offers
     * to join. Signed out, the proxy sends the visitor to login carrying this
     * whole URL, so the invitation survives having to sign in first.
     */
    private static final Map<String, String> HOUSEHOLD = Map.of(
            "fr", "/app/foyer",
            "en", "/app/household",
            "de", "/app/haushalt");

    private EmailLinks() {
    }

    private static final Map<String, String> EMAIL_CHANGE = Map.of(
            "fr", "/changement-email",
            "en", "/change-email",
            "de", "/e-mail-aendern");

    private static final Map<String, String> FORGOT = Map.of(
            "fr", "/mot-de-passe-oublie",
            "en", "/forgot-password",
            "de", "/passwort-vergessen");

    /** The page that starts a reset — no token, since the point is to ask for one. */
    public static String forgotPassword(String siteUrl, String locale) {
        String slug = FORGOT.getOrDefault(locale, FORGOT.get(FALLBACK_LOCALE));
        return siteUrl + "/" + (FORGOT.containsKey(locale) ? locale : FALLBACK_LOCALE) + slug;
    }

    public static String emailChange(String siteUrl, String locale, String token) {
        return build(siteUrl, EMAIL_CHANGE, locale, token);
    }

    public static String householdInvitation(String siteUrl, String locale, String token) {
        return build(siteUrl, HOUSEHOLD, locale, token);
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
