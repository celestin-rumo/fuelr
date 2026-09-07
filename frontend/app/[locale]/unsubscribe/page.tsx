import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@ui/card";
import { Container } from "@app/components/site/section";
import { UnsubscribePanel } from "@app/components/app/unsubscribe-panel";

/** The one-click stop from the reminder mail. No session: the link is the proof. */
export default async function UnsubscribePage({ params, searchParams }: PageProps<"/[locale]/unsubscribe">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token } = await searchParams;
  const t = await getTranslations("unsubscribe");

  return (
    <div className="flex min-h-full flex-1 items-center bg-bg py-16">
      <Container>
        <Card as="panel" className="mx-auto w-full max-w-md">
          <h1 className="font-display text-[28px] leading-[1.15] font-extrabold tracking-[-0.02em] text-text">
            {t("title")}
          </h1>
          {typeof token === "string" && token.length > 0 ? (
            <UnsubscribePanel token={token} />
          ) : (
            <p className="mt-3 text-[15px] leading-[1.6] font-medium text-text-dim">{t("noToken")}</p>
          )}
        </Card>
      </Container>
    </div>
  );
}
