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

export default function proxy(request: NextRequest) {
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
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
