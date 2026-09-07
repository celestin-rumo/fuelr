import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

const TOKEN_COOKIE = "fuelr_token";

/** `/fr/app`, `/en/app/recettes`, … — the product, whatever the locale. */
const PROTECTED = new RegExp(`^/(${routing.locales.join("|")})/app(/|$)`);

/** The login slug per locale, as declared in i18n/routing.ts. */
const LOGIN_PATH = routing.pathnames["/login"];

/**
 * A recommendation link lands on the public site with `?via=<code>`. The
 * code is kept in a cookie for thirty days so the registration, whenever it
 * happens, can carry it — and that cookie is the whole of what this feature
 * stores on the visitor's side: no pixel, no third party, nothing read by
 * anyone but the register route.
 */
const VIA_COOKIE = "fuelr_via";

export default function proxy(request: NextRequest) {
  const via = request.nextUrl.searchParams.get("via");
  if (via && /^[A-Za-z0-9]{4,24}$/.test(via)) {
    const response = intlMiddleware(request);
    response.cookies.set(VIA_COOKIE, via, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  }

  const { pathname, search } = request.nextUrl;
  const match = PROTECTED.exec(pathname);

  if (match) {
    // First gate only. It rejects visitors with no cookie at all, which is the
    // common case and saves a round trip. It deliberately does NOT try to
    // validate the token: the middleware has no way to verify a signature, and
    // a forged cookie would sail past it. The real check runs on the server in
    // app/[locale]/(app)/layout.tsx, which asks the backend.
    if (!request.cookies.get(TOKEN_COOKIE)?.value) {
      const locale = match[1] as (typeof routing.locales)[number];
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}${LOGIN_PATH[locale]}`;
      // Remember where they were headed so login can send them back.
      url.search = "";
      url.searchParams.set("next", pathname + search);
      return NextResponse.redirect(url);
    }
  }

  return intlMiddleware(request);
}

export const config = {
  // Match all pathnames except for
  // - … if they start with `/api`, `/trpc`, `/_next` or `/_vercel`
  // - … `/manifest`, which carries its own locale in the path: localising it
  //   would send the browser to `/fr/manifest/fr`
  // - … the ones containing a dot (e.g. `favicon.ico`, `sw.js`)
  matcher: "/((?!api|trpc|_next|_vercel|manifest|.*\\..*).*)",
};
