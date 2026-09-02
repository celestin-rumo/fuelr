import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getPathname } from "@/i18n/navigation";
import { getSession } from "@app/lib/session";

/**
 * Cooking mode has a layout of its own because it must not have the app's.
 *
 * A header, a nav bar and a verification banner are three things to hit by
 * accident with the back of a hand, and none of them help someone holding a
 * pan. So the route sits in its own group: the chrome is not hidden here, it
 * is not rendered.
 *
 * The session check is repeated rather than shared, and that repetition is the
 * point — this subtree is outside `(app)/layout.tsx`, so nothing else resolves
 * the session for it. The middleware in proxy.ts only sees that a cookie
 * exists; a forged one gets past it and is stopped here.
 */
export default async function CookLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) {
    redirect(getPathname({ href: "/login", locale }));
  }

  return <div className="flex min-h-full flex-1 flex-col bg-bg">{children}</div>;
}
