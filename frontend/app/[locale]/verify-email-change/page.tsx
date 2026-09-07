import { getTranslations, setRequestLocale } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import { Card } from "@ui/card";
import { Container } from "@app/components/site/section";
import { EmailChangePanel } from "@app/components/app/email-change-panel";

/**
 * The click that moves an account to its new address.
 *
 * Its own page rather than a parameter on the verification one: the two
 * links prove different things, and a page that says "address confirmed"
 * when what happened is "your login changed" would be telling a half-truth.
 */
export default async function VerifyEmailChangePage({
  params,
  searchParams,
}: PageProps<"/[locale]/verify-email-change">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token } = await searchParams;
  const t = await getTranslations("verifyEmailChange");

  return (
    <div className="flex min-h-full flex-1 items-center bg-bg py-16">
      <Container>
        <Card as="panel" className="mx-auto w-full max-w-md">
          <h1 className="font-display text-[28px] leading-[1.15] font-extrabold tracking-[-0.02em] text-text">
            {t("title")}
          </h1>
          {typeof token === "string" && token.length > 0 ? (
            <EmailChangePanel token={token} accountHref={getPathname({ href: "/app/account", locale })} />
          ) : (
            <p className="mt-3 text-[15px] leading-[1.6] font-medium text-text-dim">
              {t("noToken")}
            </p>
          )}
        </Card>
      </Container>
    </div>
  );
}
