import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getPathname } from "@/i18n/navigation";
import { getSession } from "@app/lib/session";
import { Card } from "@ui/card";
import { Container } from "@app/components/site/section";

/**
 * Placeholder sign-in screen. The real form — three modes, strength meter,
 * error states — is its own backlog story; what matters here is that the guard
 * has somewhere to send people, and that the destination survives the round
 * trip.
 */
export default async function LoginPage({
  params,
  searchParams,
}: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (session) {
    // Already signed in: no reason to show a login screen.
    redirect(getPathname({ href: "/app", locale }));
  }

  const { next } = await searchParams;
  const destination = typeof next === "string" ? next : null;
  const t = await getTranslations("auth");

  return (
    <div className="flex min-h-full flex-1 items-center bg-bg py-20">
      <Container>
        <Card as="panel" className="mx-auto max-w-lg">
          <h1 className="font-display text-[28px] leading-[1.15] font-extrabold tracking-[-0.02em] text-text">
            {t("title")}
          </h1>
          <p className="mt-3 text-[15px] leading-[1.6] font-medium text-text-dim">
            {t("intro")}
          </p>

          {destination && (
            <p
              data-testid="login-next"
              data-next={destination}
              className="mt-6 rounded-sm border border-line bg-bg-raised-2 px-4 py-3 text-[13px] font-medium text-text-dim"
            >
              {t("returnTo")} <span className="font-mono text-accent-ink">{destination}</span>
            </p>
          )}
        </Card>
      </Container>
    </div>
  );
}
