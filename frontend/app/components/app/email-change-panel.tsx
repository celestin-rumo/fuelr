"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { buttonClasses } from "@ui/button";
import { Spinner } from "@ui/spinner";

type State = "working" | "done" | "expired";

/**
 * Posts the token the moment the page opens. The link is the whole of the
 * proof, so there is nothing to ask the person first — and a dead link says
 * so plainly, with the way back rather than a retry that cannot work.
 */
export function EmailChangePanel({ token, accountHref }: { token: string; accountHref: string }) {
  const t = useTranslations("verifyEmailChange");
  const [state, setState] = useState<State>("working");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/verify-email-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((response) => {
        if (!cancelled) setState(response.ok ? "done" : "expired");
      })
      .catch(() => {
        if (!cancelled) setState("expired");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="mt-3 flex flex-col gap-4" data-testid={`email-change-${state}`}>
      {state === "working" && (
        <p className="flex items-center gap-2 text-[15px] font-medium text-text-dim">
          <Spinner /> {t("working")}
        </p>
      )}
      {state === "done" && (
        <p className="text-[15px] leading-[1.6] font-medium text-text">{t("done")}</p>
      )}
      {state === "expired" && (
        <p className="text-[15px] leading-[1.6] font-medium text-text-dim">{t("expired")}</p>
      )}
      {state !== "working" && (
        <div>
          <a href={accountHref} className={buttonClasses()}>
            {t("toAccount")}
          </a>
        </div>
      )}
    </div>
  );
}
