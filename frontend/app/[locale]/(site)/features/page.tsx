import { use } from "react";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Card } from "@ui/card";
import { CtaBand } from "@app/components/site/cta-band";
import { FeatureCard } from "@app/components/site/feature-card";
import type { FeatureTone } from "@app/components/site/feature-card";
import { Section, SectionHead } from "@app/components/site/section";

type Feature = {
  icon: string;
  tone: FeatureTone;
  title: string;
  text: string;
  meta: string;
};

function CookingMode() {
  const t = useTranslations("site.features.cooking");
  const points = t.raw("points") as string[];

  return (
    <Section muted>
      <Card as="panel" className="flex flex-col gap-5">
        <h2 className="font-display text-[22px] font-extrabold tracking-[-0.02em] text-text">
          {t("title")}
        </h2>
        <p className="max-w-[68ch] text-[15px] leading-[1.6] font-medium text-text-dim">
          {t("text")}
        </p>
        <ul className="flex flex-col gap-3">
          {points.map((point) => (
            <li
              key={point}
              className="flex items-start gap-3 text-[14px] leading-[1.5] font-medium text-text"
            >
              <span aria-hidden className="mt-0.5 font-bold text-accent-ink">
                ✓
              </span>
              {point}
            </li>
          ))}
        </ul>
      </Card>
    </Section>
  );
}

export default function FeaturesPage({ params }: PageProps<"/[locale]/features">) {
  const { locale } = use(params);
  setRequestLocale(locale);

  const t = useTranslations("site.features");
  const items = t.raw("items") as Feature[];

  return (
    <>
      <Section>
        <SectionHead label={t("label")} title={t("title")} text={t("text")} />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <FeatureCard key={item.title} {...item} />
          ))}
        </div>
      </Section>
      <CookingMode />
      <CtaBand />
    </>
  );
}
