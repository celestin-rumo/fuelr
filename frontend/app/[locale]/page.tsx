import { useTranslations } from "next-intl";
import { ThemeToggle } from "@app/components/theme-toggle";
import { Link } from "@/i18n/navigation";
import { Button } from "@ui/button";
import { Card, CardBody, CardTitle } from "@ui/card";

export default function Home() {
  const t = useTranslations("home");

  return (
    <div className="flex flex-1 flex-col items-center bg-bg px-6 py-16">
      <main className="flex w-full max-w-3xl flex-col gap-12">
        <header className="flex items-center justify-between">
          <span className="font-mono text-sm text-text-dim">fuelr</span>
          <ThemeToggle />
        </header>

        <div className="flex flex-col items-start gap-6">
          <h1 className="font-display text-[44px] leading-[1.1] font-extrabold tracking-[-0.02em] text-text">
            {t("title")}
          </h1>
          <p className="max-w-[68ch] text-[15px] leading-[1.5] font-medium text-text-dim">
            {t("tagline")}
          </p>
          <Button size="lg">{t("cta")}</Button>
        </div>

        <Card interactive>
          <CardTitle>{t("next.title")}</CardTitle>
          <CardBody>{t("next.body")}</CardBody>
          <Link
            href="/design-system"
            className="mt-4 inline-block text-[13px] font-semibold text-mint-ink hover:underline"
          >
            {t("next.link")} →
          </Link>
        </Card>
      </main>
    </div>
  );
}
