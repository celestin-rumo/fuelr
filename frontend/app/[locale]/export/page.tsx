import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@ui/card";
import { buttonClasses } from "@ui/button";
import { Container } from "@app/components/site/section";

/**
 * Where the export link lands.
 *
 * A page rather than a direct download, so the person sees what they are
 * about to fetch and that it works once — a browser that prefetches links
 * would otherwise spend the one download on a hover.
 */
export default async function ExportPage({ params, searchParams }: PageProps<"/[locale]/export">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token } = await searchParams;
  const t = await getTranslations("exportPage");
  const usable = typeof token === "string" && token.length > 0;

  return (
    <div className="flex min-h-full flex-1 items-center bg-bg py-16">
      <Container>
        <Card as="panel" className="mx-auto flex w-full max-w-md flex-col gap-4">
          <h1 className="font-display text-[28px] leading-[1.15] font-extrabold tracking-[-0.02em] text-text">
            {t("title")}
          </h1>
          <p className="text-[15px] leading-[1.6] font-medium text-text-dim">
            {usable ? t("body") : t("noToken")}
          </p>
          {usable && (
            <div>
              <a
                href={`/api/account/export/${encodeURIComponent(token)}`}
                data-testid="export-download"
                className={buttonClasses()}
              >
                {t("download")}
              </a>
            </div>
          )}
        </Card>
      </Container>
    </div>
  );
}
