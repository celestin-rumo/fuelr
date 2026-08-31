package ch.celestin.fuelr.auth;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.oauth2.server.resource.web.BearerTokenResolver;
import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver;

/**
 * Reads the token from the `Authorization: Bearer …` header first — that is how
 * a native client authenticates — and falls back to the httpOnly cookie the web
 * client is given, so browser JavaScript never has to hold the token.
 */
public class CookieOrHeaderTokenResolver implements BearerTokenResolver {

    public static final String COOKIE_NAME = "fuelr_token";

    private final BearerTokenResolver header = new DefaultBearerTokenResolver();

    @Override
    public String resolve(HttpServletRequest request) {
        String fromHeader = header.resolve(request);
        if (fromHeader != null) {
            return fromHeader;
        }
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (COOKIE_NAME.equals(cookie.getName()) && !cookie.getValue().isBlank()) {
                return cookie.getValue();
            }
        }
        return null;
    }
}
