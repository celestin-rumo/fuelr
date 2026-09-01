"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@ui/button";

/**
 * Non-blocking on purpose: the account works, so this asks rather than
 * demands. It can be dismissed for the visit, and comes back next time —
 * the address still needs proving, and a banner that never returns would
 * quietly become a banner that never worked.
 */
export function VerifyEmailBanner({ email }: { email: string }) {
  const t = useTranslations("verifyBanner");
  const locale = useLocale();

  const [dismissed, setDismissed] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  if (dismissed) return null;

  async function resend() {
    setState("sending");
    await fetch(`/api/auth/verify-email/resend?locale=${locale}`, { method: "POST" });
    setState("sent");
  }

  return (
    // Neutral, not tinted: lime already means "action" on this page, and a
    // lime notice would give one colour two jobs. bg-raised-2 keeps it
    // distinct from both the header above it and the page ground below.
    <div
      data-testid="verify-banner"
      className="border-b border-line bg-bg-raised-2"
    >
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:gap-4 md:px-10">
        <p className="flex-1 text-[13px] leading-[1.5] font-medium text-text">
          {state === "sent" ? t("sent") : t("message", { email })}
        </p>

        <div className="flex shrink-0 items-center gap-2">
          {state !== "sent" && (
            <Button
              variant="secondary"
              size="sm"
              loading={state === "sending"}
              onClick={resend}
            >
              {t("resend")}
            </Button>
          )}
          <Button variant="text" size="sm" onClick={() => setDismissed(true)}>
            {t("dismiss")}
          </Button>
        </div>
      </div>
    </div>
  );
}
