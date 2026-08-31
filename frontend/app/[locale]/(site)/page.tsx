import { use } from "react";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Card } from "@ui/card";
import { Hero } from "@app/components/site/hero";
import { CtaBand } from "@app/components/site/cta-band";
import { FeatureCard } from "@app/components/site/feature-card";
import type { FeatureTone } from "@app/components/site/feature-card";
import { Container, Section, SectionHead } from "@app/components/site/section";

type Stat = { value: string; label: string };
type LoopStep = { num: string; title: string; text: string };
type Feature = {
  icon: string;
  tone: FeatureTone;
  title: string;
  text: string;
  meta: string;
};

function Stats() {
  const t = useTranslations("site");
  const stats = t.raw("stats") as Stat[];

  return (
    <section className="border-b border-line py-12">
      <Container>
        <dl className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.value}>
              <dt className="tnum font-display text-[32px] leading-none font-extrabold tracking-[-0.02em] text-accent-ink">
                {stat.value}
              </dt>
              <dd className="mt-2 text-[13px] leading-[1.5] font-medium text-text-dim">
                {stat.label}
              </dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}

function Loop() {
  const t = useTranslations("site.loop");
  const steps = t.raw("steps") as LoopStep[];

  return (
    <Section muted>
      <SectionHead label={t("label")} title={t("title")} text={t("text")} />
      <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((step) => (
          <li key={step.num}>
            <Card className="h-full">
              <span className="font-mono text-[13px] text-accent-ink">
                {step.num}
              </span>
              <h3 className="mt-2 font-display text-base font-bold text-text">
                {step.title}
              </h3>
              <p className="mt-2 text-[14px] leading-[1.5] font-medium text-text-dim">
                {step.text}
              </p>
            </Card>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function Testimonial() {
  const t = useTranslations("site.testimonial");

  return (
    <Section>
      <figure className="flex flex-col gap-5">
        <figcaption className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
          {t("label")}
        </figcaption>
        <blockquote className="max-w-[52ch] font-display text-[22px] leading-[1.3] font-bold tracking-[-0.01em] text-text md:text-[28px]">
          « {t("quote")} »
        </blockquote>
        <p className="text-[13px] font-semibold text-text-dim">{t("author")}</p>
      </figure>
    </Section>
  );
}

function FeaturesTeaser() {
  const t = useTranslations("site.features");
  const items = (t.raw("items") as Feature[]).slice(0, 3);

  return (
    <Section muted>
      <SectionHead label={t("label")} title={t("title")} text={t("text")} />
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {items.map((item) => (
          <FeatureCard key={item.title} {...item} />
        ))}
      </div>
    </Section>
  );
}

export default function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale);

  return (
    <>
      <Hero />
      <Stats />
      <Loop />
      <Testimonial />
      <FeaturesTeaser />
      <CtaBand />
    </>
  );
}
