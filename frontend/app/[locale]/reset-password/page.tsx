import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, getPathname } from "@/i18n/navigation";
import { Card } from "@ui/card";
import { Container } from "@app/components/site/section";
import { ResetPasswordForm } from "@app/components/app/reset-password-form";

export default async function ResetPasswordPage({
  params,
  searchParams,
}: PageProps<"/[locale]/reset-password">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { token } = await searchParams;
  const t = await getTranslations("resetPassword");

  return (
    <div className="flex min-h-full flex-1 items-center bg-bg py-16">
      <Container>
        <Card as="panel" className="mx-auto w-full max-w-md">
          <h1 className="font-display text-[28px] leading-[1.15] font-extrabold tracking-[-0.02em] text-text">
            {t("title")}
          </h1>

          {typeof token === "string" && token.length > 0 ? (
            <>
              <p className="mt-3 text-[15px] leading-[1.6] font-medium text-text-dim">
                {t("intro")}
              </p>
              <div className="mt-8">
                <ResetPasswordForm
                  token={token}
                  loginHref={getPathname({ href: "/login", locale })}
                />
              </div>
            </>
          ) : (
            // Reached without a link — most often an email client that dropped
            // the query string. Sending them back to ask for another one is
            // more use than an error.
            <>
              <p
                data-testid="reset-no-token"
                className="mt-3 text-[15px] leading-[1.6] font-medium text-text-dim"
              >
                {t("noToken")}
              </p>
              <p className="mt-6 text-[13px] font-medium text-text-dim">
                <Link
                  href="/forgot-password"
                  className="font-semibold text-accent-ink underline"
                >
                  {t("askAgain")}
                </Link>
              </p>
            </>
          )}
        </Card>
      </Container>
    </div>
  );
}
