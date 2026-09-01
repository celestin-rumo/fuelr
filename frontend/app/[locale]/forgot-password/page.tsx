import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Card } from "@ui/card";
import { Container } from "@app/components/site/section";
import { ForgotPasswordForm } from "@app/components/app/forgot-password-form";

export default async function ForgotPasswordPage({
  params,
}: PageProps<"/[locale]/forgot-password">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("forgotPassword");

  return (
    <div className="flex min-h-full flex-1 items-center bg-bg py-16">
      <Container>
        <Card as="panel" className="mx-auto w-full max-w-md">
          <h1 className="font-display text-[28px] leading-[1.15] font-extrabold tracking-[-0.02em] text-text">
            {t("title")}
          </h1>
          <p className="mt-3 text-[15px] leading-[1.6] font-medium text-text-dim">
            {t("intro")}
          </p>

          <div className="mt-8">
            <ForgotPasswordForm />
          </div>

          <p className="mt-6 text-[13px] font-medium text-text-dim">
            <Link href="/login" className="font-semibold text-accent-ink underline">
              {t("backToLogin")}
            </Link>
          </p>
        </Card>
      </Container>
    </div>
  );
}
