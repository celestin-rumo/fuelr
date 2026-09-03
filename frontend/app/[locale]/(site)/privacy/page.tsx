import { use } from "react";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@ui/cn";
import { Section, SectionHead } from "@app/components/site/section";

/**
 * One section of the page. `tone` lifts the one that is the reason the page
 * exists — that the AI features are processed outside Switzerland. `items`
 * is for a section that is a list rather than a paragraph.
 */
type Block = {
  title: string;
  text?: string;
  items?: string[];
  tone?: "mint";
  link?: "/contact";
  linkLabel?: string;
};

export default function PrivacyPage({ params }: PageProps<"/[locale]/privacy">) {
  const { locale } = use(params);
  setRequestLocale(locale);

  const t = useTranslations("site.privacy");
  const blocks = t.raw("sections") as Block[];

  return (
    <Section>
      <SectionHead label={t("label")} title={t("title")} text={t("text")} />

      {/* A prose column, not cards: this is read from top to bottom, and a
          grid of tiles would say the six answers are interchangeable. */}
      <div className="mt-10 flex max-w-[68ch] flex-col gap-8">
        {blocks.map((block) => (
          <article
            key={block.title}
            className={cn(
              "flex flex-col gap-3 border-l-2 pl-5",
              block.tone === "mint" ? "border-mint-ink" : "border-line",
            )}
          >
            {/* h3: SectionHead above is the page's h2, and a section title
                that outranks the page's own would break the outline. */}
            <h3 className="font-display text-[18px] leading-[1.2] font-extrabold tracking-[-0.02em] text-text">
              {block.title}
            </h3>

            {block.text && (
              <p className="text-[15px] leading-[1.6] font-medium text-text-dim">
                {block.text}
              </p>
            )}

            {block.items && (
              <ul className="flex flex-col gap-3">
                {block.items.map((item) => (
                  <li
                    key={item}
                    className="grid grid-cols-[auto_1fr] gap-3 text-[15px] leading-[1.6] font-medium text-text-dim"
                  >
                    <span aria-hidden className="font-mono text-gray">
                      —
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}

            {block.link && (
              <Link
                href={block.link}
                className="inline-flex min-h-11 items-center text-[13px] font-semibold text-mint-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)] sm:min-h-0"
              >
                {block.linkLabel}
              </Link>
            )}
          </article>
        ))}

        <p className="text-[12px] font-semibold text-gray">{t("updated")}</p>
      </div>
    </Section>
  );
}
