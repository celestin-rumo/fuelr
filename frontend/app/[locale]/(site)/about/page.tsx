import { use } from "react";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Card } from "@ui/card";
import { cn } from "@ui/cn";
import { CtaBand } from "@app/components/site/cta-band";
import { Section, SectionHead } from "@app/components/site/section";

type Principle = {
  tag: string;
  tone: "accent" | "mint" | "coral";
  title: string;
  text: string;
};

type Member = { name: string; role: string };

const tagTones = {
  accent: "text-accent-ink",
  mint: "text-mint-ink",
  coral: "text-coral-ink",
} as const;

function Team() {
  const t = useTranslations("site.about.team");
  const members = t.raw("members") as Member[];

  return (
    <Section muted>
      <SectionHead title={t("title")} text={t("text")} />
      <ul className="mt-10 grid grid-cols-2 gap-5 lg:grid-cols-4">
        {members.map((member) => (
          <li key={member.name}>
            <Card className="flex flex-col items-start">
              {/* Portraits are not in the repo yet; the tile keeps the 1:1
                  slot the design reserves for them. */}
              <div
                aria-hidden
                className="mb-4 aspect-square w-full rounded-md bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent)_22%,transparent),color-mix(in_srgb,var(--mint)_18%,transparent))]"
              />
              <h3 className="font-display text-base font-bold text-text">
                {member.name}
              </h3>
              <p className="mt-1 text-[13px] font-semibold text-text-dim">
                {member.role}
              </p>
            </Card>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export default function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const { locale } = use(params);
  setRequestLocale(locale);

  const t = useTranslations("site.about");
  const principles = t.raw("principles") as Principle[];

  return (
    <>
      <Section>
        <SectionHead label={t("label")} title={t("title")} text={t("text")} />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {principles.map((principle) => (
            <Card key={principle.tag} className="flex flex-col">
              <span
                className={cn(
                  "text-[11px] font-bold tracking-[0.02em] uppercase",
                  tagTones[principle.tone],
                )}
              >
                {principle.tag}
              </span>
              <h3 className="mt-3 font-display text-base font-bold text-text">
                {principle.title}
              </h3>
              <p className="mt-2 text-[15px] leading-[1.5] font-medium text-text-dim">
                {principle.text}
              </p>
            </Card>
          ))}
        </div>
      </Section>

      <Team />
      <CtaBand />
    </>
  );
}
