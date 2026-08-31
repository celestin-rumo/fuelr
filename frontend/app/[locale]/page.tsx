import { useTranslations } from "next-intl";
import { ThemeToggle } from "@app/components/theme-toggle";
import { Button } from "@ui/button";
import { Card, CardBody, CardTitle } from "@ui/card";

export default function Home() {
  const t = useTranslations("home");

  return (
    <div className="flex flex-1 flex-col items-center bg-muted px-6 py-16">
      <main className="flex w-full max-w-3xl flex-col gap-12">
        <header className="flex items-center justify-between">
          <span className="font-mono text-sm text-muted-foreground">fuelr</span>
          <ThemeToggle />
        </header>

        <div className="flex flex-col items-start gap-6">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="max-w-md text-lg leading-8 text-muted-foreground">
            {t("tagline")}
          </p>
          <Button size="lg">{t("cta")}</Button>
        </div>

        <Card>
          <CardTitle>{t("next.title")}</CardTitle>
          <CardBody>{t("next.body")}</CardBody>
        </Card>
      </main>
    </div>
  );
}
