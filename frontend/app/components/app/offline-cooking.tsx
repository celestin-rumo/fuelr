"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@ui/button";
import { EmptyState } from "@ui/empty-state";
import { readSession } from "@app/lib/cooking-session";
import { useHydrated } from "@app/lib/use-hydrated";
import { CookingMode } from "./cooking-mode";

/**
 * The offline page's whole content.
 *
 * A dish under way carries its own recipe, so there is nothing to fetch and
 * cooking simply continues — steps, timers, ingredients and the screen staying
 * awake all work with no network. With nothing under way there is nothing this
 * page can do but say so.
 */
export function OfflineCooking() {
  const hydrated = useHydrated();
  if (!hydrated) return null;
  return <Offline />;
}

function Offline() {
  const t = useTranslations("cook.offline");
  const [session] = useState(readSession);

  if (session?.recipe) return <CookingMode recipe={session.recipe} offline />;

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
