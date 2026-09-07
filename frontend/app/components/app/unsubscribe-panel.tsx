"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Spinner } from "@ui/spinner";

/** Posts the token the moment the page opens; a dead link says so plainly. */
export function UnsubscribePanel({ token }: { token: string }) {
  const t = useTranslations("unsubscribe");
  const [state, setState] = useState<"working" | "done" | "expired">("working");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/reminder/unsubscribe", {
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
    <p className="mt-3 flex items-center gap-2 text-[15px] leading-[1.6] font-medium text-text-dim" data-testid={`unsubscribe-${state}`}>
      {state === "working" && <Spinner />}
      {t(state)}
    </p>
  );
}
