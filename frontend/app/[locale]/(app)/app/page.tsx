import { getTranslations } from "next-intl/server";
import { getSession } from "@app/lib/session";
import { Card, CardBody, CardTitle } from "@ui/card";
import { Container } from "@app/components/site/section";

/**
 * Placeholder product home. The planning, recipe and shopping screens are
 * separate backlog stories — this exists so the guard has something to guard.
 */
export default async function AppHomePage() {
  const t = await getTranslations("app");
  const session = await getSession();

  return (
    <Container className="flex flex-col gap-8 py-14">
      <div className="flex flex-col gap-3">
        <span className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
          {t("label")}
        </span>
        <h1 className="font-display text-[32px] leading-[1.1] font-extrabold tracking-[-0.02em] text-text">
          {t("greeting", { name: session?.name ?? session?.email ?? "" })}
        </h1>
        <p className="max-w-[68ch] text-[15px] leading-[1.6] font-medium text-text-dim">
          {t("intro")}
        </p>
      </div>

      <Card as="panel">
        <CardTitle>{t("next.title")}</CardTitle>
        <CardBody>{t("next.body")}</CardBody>
      </Card>
    </Container>
  );
}
