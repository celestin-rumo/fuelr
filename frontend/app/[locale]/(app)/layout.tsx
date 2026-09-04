import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getPathname } from "@/i18n/navigation";
import { getSession } from "@app/lib/session";
import { AppHeader } from "@app/components/app/app-header";
import { VerifyEmailBanner } from "@app/components/app/verify-email-banner";
import { CookingResumeBanner } from "@app/components/app/cooking-resume-banner";
import { AppTabs } from "@app/components/app/app-tabs";

/**
 * Everything under /app is behind this layout, and this is where access is
 * actually decided.
 *
 * The middleware in proxy.ts only checks that a cookie exists — it cannot
 * verify a signature, so a hand-written cookie gets past it. Here the session
 * is resolved against the backend before a single child renders, which is what
 * makes the guard server-side rather than cosmetic.
 */
export default async function AppLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) {
    // Next's own redirect is typed `never`, so the session is narrowed below;
    // getPathname still resolves the locale's own login slug.
    redirect(getPathname({ href: "/login", locale }));
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-bg">
      <AppHeader email={session.email} name={session.name} />
      {!session.emailVerified && <VerifyEmailBanner email={session.email} />}
      {/* A dish left mid-way is the first thing to say on coming back, and it
          belongs on every screen of the app rather than on one of them. */}
      <CookingResumeBanner />
      {/* The tab bar is fixed, so the content reserves the room rather than
          being covered by it — 56px of bar plus the home indicator below. */}
      <main className="flex-1 pb-[calc(3.5rem+env(safe-area-inset-bottom))] sm:pb-0">
        {children}
      </main>
      <AppTabs />
    </div>
  );
}
