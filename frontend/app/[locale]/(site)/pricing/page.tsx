import { getTranslations, setRequestLocale } from "next-intl/server";
import { CtaBand } from "@app/components/site/cta-band";
import { Faq } from "@app/components/site/faq";
import type { FaqItem } from "@app/components/site/faq";
import { PricingPlans } from "@app/components/site/pricing";
import { Section, SectionHead } from "@app/components/site/section";
import { fetchPlans } from "@app/lib/api";

export default async function PricingPage({ params }: PageProps<"/[locale]/pricing">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("site.pricing");
  const faqItems = t.raw("faq.items") as FaqItem[];
  // Fetched per request rather than baked into the build: this page and the
  // checkout have to name the same figure, and a price frozen at build time
  // is the one way they drift apart.
  const prices = await fetchPlans();

  return (
    <>
      <Section>
        <SectionHead label={t("label")} title={t("title")} text={t("text")} />
        <div className="mt-10">
          <PricingPlans prices={prices} />
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
