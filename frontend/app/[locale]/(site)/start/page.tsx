import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container } from "@app/components/site/section";
import { Onboarding } from "@app/components/site/onboarding";

export default async function StartPage({
  params,
}: PageProps<"/[locale]/start">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("onboarding");

  return (
    <Container className="py-16">
      <h1 className="mx-auto max-w-2xl font-display text-[32px] leading-[1.15] font-extrabold tracking-[-0.02em] text-text sm:text-[44px]">
        {t("title")}
      </h1>
      <p className="mx-auto mt-4 mb-10 max-w-2xl text-[17px] leading-[1.6] font-medium text-text-dim">
        {t("intro")}
      </p>
      <Onboarding />
    </Container>
  );
}
