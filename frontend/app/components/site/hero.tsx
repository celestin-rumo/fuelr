import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge } from "@ui/badge";
import { buttonClasses } from "@ui/button";
import { Container } from "./section";

export function Hero() {
  const t = useTranslations("site.hero");
  const proofs = t.raw("proofs") as string[];

  return (
    <section className="border-b border-line py-20 md:py-28">
      <Container className="flex flex-col items-start gap-7">
        <Badge tone="accent">{t("badge")}</Badge>

        <h1 className="max-w-[18ch] font-display text-[40px] leading-[1.1] font-extrabold tracking-[-0.02em] text-text md:text-[56px]">
          {t("title")}
        </h1>

        <p className="max-w-[62ch] text-[17px] leading-[1.6] font-medium text-text-dim">
          {t("text")}
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          {/* Real links, not Buttons: these navigate. A Button with no
              handler renders fine and does nothing at all, which is how both
              of these shipped dead. */}
          <Link href="/start" className={buttonClasses({ size: "lg" })}>
            {t("ctaPrimary")}
          </Link>
          <Link
            href="/features"
            className={buttonClasses({ size: "lg", variant: "secondary" })}
          >
            {t("ctaSecondary")}
          </Link>
        </div>

        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] font-semibold text-text-dim">
          {proofs.map((proof) => (
            <li key={proof} className="flex items-center gap-2">
              <span aria-hidden className="text-accent-ink">
                ✓
              </span>
              {proof}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
