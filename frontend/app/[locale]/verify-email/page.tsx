import { getTranslations, setRequestLocale } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import { Card } from "@ui/card";
import { Container } from "@app/components/site/section";
import { VerifyEmailPanel } from "@app/components/app/verify-email-panel";

export default async function VerifyEmailPage({
  params,
  searchParams,
}: PageProps<"/[locale]/verify-email">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { token } = await searchParams;
  const t = await getTranslations("verifyEmail");

  return (
    <div className="flex min-h-full flex-1 items-center bg-bg py-16">
      <Container>
        <Card as="panel" className="mx-auto w-full max-w-md">
          <h1 className="font-display text-[28px] leading-[1.15] font-extrabold tracking-[-0.02em] text-text">
            {t("title")}
          </h1>

          {typeof token === "string" && token.length > 0 ? (
            <VerifyEmailPanel
              token={token}
              appHref={getPathname({ href: "/app", locale })}
            />
          ) : (
            <p
              data-testid="verify-no-token"
              className="mt-3 text-[15px] leading-[1.6] font-medium text-text-dim"
            >
              {t("noToken")}
            </p>
          )}
        </Card>
      </Container>
    </div>
  );
}
