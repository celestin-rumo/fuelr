import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@ui/card";
import { Container } from "@app/components/site/section";
import { ImportForm } from "@app/components/app/import-form";
import { importSources } from "@app/lib/api";

export const dynamic = "force-dynamic";

export default async function ImportRecipePage({
  params,
}: PageProps<"/[locale]/app/recipes/import">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("import");
  const sources = await importSources();

  return (
    <Container className="py-12">
      <Card as="panel" className="mx-auto w-full max-w-xl">
        <h1 className="font-display text-[28px] leading-[1.15] font-extrabold tracking-[-0.02em] text-text">
          {t("title")}
        </h1>
        <p className="mt-3 text-[15px] leading-[1.6] font-medium text-text-dim">
          {t("intro")}
        </p>

        <div className="mt-8">
          <ImportForm sources={sources} />
        </div>
      </Card>
    </Container>
  );
}
