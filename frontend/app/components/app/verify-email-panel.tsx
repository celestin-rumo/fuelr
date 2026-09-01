"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@ui/button";
import { Spinner } from "@ui/spinner";

/**
 * Confirms the address as soon as the page opens. There is nothing to ask:
 * whoever followed the link already said yes by clicking it, and a second
 * "confirm" button would only be an obstacle.
 */
export function VerifyEmailPanel({
  token,
  appHref,
}: {
  token: string;
  appHref: string;
}) {
  const t = useTranslations("verifyEmail");
  const router = useRouter();
  const [state, setState] = useState<"working" | "done" | "failed">("working");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!cancelled) setState(response.ok ? "done" : "failed");
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === "working") {
    return (
      <p className="mt-6 flex items-center gap-3 text-[15px] font-medium text-text-dim">
        <Spinner />
        {t("working")}
      </p>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-5">
      <p
        role="status"
        data-testid={state === "done" ? "verify-done" : "verify-failed"}
        className={`text-[15px] leading-[1.6] font-semibold ${
          state === "done" ? "text-mint-ink" : "text-coral-ink"
        }`}
      >
        <span aria-hidden>{state === "done" ? "✓ " : "! "}</span>
        {t(state === "done" ? "done" : "failed")}
      </p>

      <Button size="lg" onClick={() => router.push(appHref)}>
        {t("continue")}
      </Button>
    </div>
  );
}
