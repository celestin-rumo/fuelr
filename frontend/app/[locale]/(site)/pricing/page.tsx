import { use } from "react";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { CtaBand } from "@app/components/site/cta-band";
import { Faq } from "@app/components/site/faq";
import type { FaqItem } from "@app/components/site/faq";
import { PricingPlans } from "@app/components/site/pricing";
import { Section, SectionHead } from "@app/components/site/section";

export default function PricingPage({ params }: PageProps<"/[locale]/pricing">) {
  const { locale } = use(params);
  setRequestLocale(locale);

  const t = useTranslations("site.pricing");
  const faqItems = t.raw("faq.items") as FaqItem[];

  return (
    <>
      <Section>
        <SectionHead label={t("label")} title={t("title")} text={t("text")} />
        <div className="mt-10">
          <PricingPlans />
        </div>
      </Section>

      <Section muted>
        <h2 className="font-display text-[22px] font-extrabold tracking-[-0.02em] text-text">
          {t("faq.title")}
        </h2>
        <div className="mt-6">
          <Faq items={faqItems} />
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
