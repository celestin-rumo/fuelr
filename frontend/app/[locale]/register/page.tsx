import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getPathname } from "@/i18n/navigation";
import { getSession } from "@app/lib/session";
import { Card } from "@ui/card";
import { Container } from "@app/components/site/section";
import { RegisterForm } from "@app/components/app/register-form";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  params,
}: PageProps<"/[locale]/register">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (session) {
    redirect(getPathname({ href: "/app", locale }));
  }

  const t = await getTranslations("register");

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
            <RegisterForm />
          </div>
        </Card>
      </Container>
    </div>
  );
}
