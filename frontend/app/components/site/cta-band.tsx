import { useTranslations } from "next-intl";
import { Button } from "@ui/button";
import { Container } from "./section";

/** Closing call to action, repeated at the foot of every marketing page. */
export function CtaBand() {
  const t = useTranslations("site.cta");

  return (
    <section className="border-t border-line py-16 md:py-20">
      <Container>
        <div className="flex flex-col items-start gap-6 rounded-lg border border-accent-ink bg-[color-mix(in_srgb,var(--accent)_10%,var(--bg-raised))] p-8 md:p-12">
          <h2 className="max-w-[20ch] font-display text-[26px] leading-[1.15] font-extrabold tracking-[-0.02em] text-text md:text-[32px]">
            {t("title")}
          </h2>
          <p className="max-w-[62ch] text-[15px] leading-[1.6] font-medium text-text-dim">
            {t("text")}
          </p>
          <Button size="lg">{t("button")}</Button>
        </div>
      </Container>
    </section>
  );
}
