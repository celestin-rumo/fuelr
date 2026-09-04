import { getTranslations } from "next-intl/server";
import { apiFetch } from "@app/lib/api";
import type { PantryItem, ShoppingListView } from "@app/lib/api";
import { isIsoDate, mondayOf, todayIso } from "@app/lib/week";
import { EmptyState } from "@ui/empty-state";
import { Container } from "@app/components/site/section";
import { ShoppingList } from "@app/components/app/shopping-list";
import { Icon } from "@ui/icons";

export const dynamic = "force-dynamic";

export default async function ShoppingPage({
  searchParams,
}: PageProps<"/[locale]/app/shopping">) {
  const t = await getTranslations("shopping");

  const { week } = await searchParams;
  const requested = isIsoDate(week) ? week : todayIso();

  const [listResponse, pantryResponse] = await Promise.all([
    apiFetch(`/api/shopping?week=${requested}`),
    apiFetch("/api/pantry"),
  ]);

  const list: ShoppingListView | null = listResponse.ok ? await listResponse.json() : null;
  const pantry: PantryItem[] = pantryResponse.ok ? await pantryResponse.json() : [];

  if (!list) {
    return (
      <Container className="py-14">
        <EmptyState
          tone="error"
          icon={<Icon name="alert" size={24} />}
          title={t("unavailable.title")}
          body={t("unavailable.body")}
        />
      </Container>
    );
  }

  return (
    <Container className="flex max-w-3xl flex-col gap-8 py-14">
      <div className="flex flex-col gap-3">
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

      {/* The week comes back from the server already normalised to its Monday,
          so the links either side move by whole weeks from the same place. */}
      <ShoppingList
        list={list}
        pantry={pantry}
        week={mondayOf(list.weekStart)}
      />
    </Container>
  );
}
