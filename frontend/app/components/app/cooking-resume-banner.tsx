"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Banner } from "@ui/banner";
import { Button, buttonClasses } from "@ui/button";
import type { CookingSession } from "@app/lib/cooking-session";
import { clearSession, readSession } from "@app/lib/cooking-session";
import { useHydrated } from "@app/lib/use-hydrated";

/**
 * "Curry — step 3 of 5", waiting where the cook comes back to.
 *
 * The session lives on the device, so nothing is rendered until hydration is
 * done and the storage can be read straight into state — see `useHydrated`.
 */
export function CookingResumeBanner() {
  const hydrated = useHydrated();
  if (!hydrated) return null;
  return <ResumeBanner />;
}

function ResumeBanner() {
  const t = useTranslations("cook.resume");
  const [session, setSession] = useState<CookingSession | null>(readSession);

  if (!session) return null;

  return (
    <div className="px-4 pt-4">
      <Banner
        tone="info"
        data-testid="cook-resume"
        title={t("title")}
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href={{
                pathname: "/app/recipes/[id]/cook",
                params: { id: String(session.recipeId) },
              }}
              className={buttonClasses({ variant: "primary", size: "sm" })}
            >
              {t("resume")}
            </Link>
            {/* Discarding, not dismissing: hiding it and keeping it would put
                the same banner back on the next page. */}
            <Button
              variant="text"
              size="sm"
              onClick={() => {
                clearSession();
                setSession(null);
              }}
            >
              {t("discard")}
            </Button>
          </div>
        }
      >
        {t("body", {
          recipe: session.title,
          number: session.stepIndex + 1,
          total: session.stepCount,
        })}
      </Banner>
    </div>
  );
}
