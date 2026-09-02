"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@ui/button";
import { EmptyState } from "@ui/empty-state";
import { readSession } from "@app/lib/cooking-session";
import { readList } from "@app/lib/shopping-offline";
import { useHydrated } from "@app/lib/use-hydrated";
import { CookingMode } from "./cooking-mode";
import { ShoppingList } from "./shopping-list";
import { Container } from "@app/components/site/section";

/**
 * The offline page's whole content: what can still be done with no network.
 *
 * A dish under way carries its own recipe, so cooking simply continues. Failing
 * that, the shopping list was copied to the device the last time it was open —
 * which is the case this page mostly exists for, since a supermarket basement
 * is where the network goes and the list is needed. Ticks made here are kept
 * and sent when something answers again.
 *
 * With neither there is nothing this page can do but say so.
 */
export function OfflineCooking() {
  const hydrated = useHydrated();
  if (!hydrated) return null;
  return <Offline />;
}

function Offline() {
  const t = useTranslations("cook.offline");
  const [session] = useState(readSession);
  const [shopping] = useState(readList);

  if (session?.recipe) return <CookingMode recipe={session.recipe} offline />;

  if (shopping) {
    return (
      <Container className="flex max-w-3xl flex-col gap-6 py-10">
        <ShoppingList
          list={shopping.list}
          pantry={[]}
          week={shopping.week}
          offline
        />
      </Container>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl items-center px-6">
      <EmptyState
        icon="⚡"
        title={t("title")}
        body={t("body")}
        action={
          <Button onClick={() => window.location.reload()}>{t("retry")}</Button>
        }
      />
    </div>
  );
}
