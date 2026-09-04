import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container } from "@app/components/site/section";
import { MenuSuggestions } from "@app/components/app/menu-suggestions";
import { todayIso, mondayOf } from "@app/lib/week";

export const dynamic = "force-dynamic";

/**
 * What to cook, from what is in the bag.
 *
 * A page rather than a sheet over another screen: it is a place somebody
 * arrives at with a question, and it has to survive a reload with the answer
 * still on it.
 */
export default async function MenuPage({ params }: PageProps<"/[locale]/app/menu">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("menu");

  return (
    <Container className="flex flex-col gap-6 py-12">
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
          {t("label")}
        </span>
        <h1 className="font-display text-[32px] leading-[1.1] font-extrabold tracking-[-0.02em] text-text">
          {t("title")}
        </h1>
        <p className="max-w-[68ch] text-[15px] leading-[1.5] font-medium text-text-dim">
          {t("intro")}
        </p>
      </div>

      {/* The week the shopping list is on, so "add what is missing" lands
          where the cook is actually shopping for. */}
      <MenuSuggestions week={mondayOf(todayIso())} />
    </Container>
  );
}
