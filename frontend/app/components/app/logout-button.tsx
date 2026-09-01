"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@ui/button";

export function LogoutButton() {
  const t = useTranslations("auth");
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    // A full navigation, not a client-side push. The lint rule is about SPA
    // routing, and logout is exactly the case that wants the opposite: on a
    // shared machine nothing of the signed-in session should survive in
    // memory. The root redirects to the visitor's locale.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/";
  }

  return (
    // Below `sm` the label alone is wider than what the header has left, and
    // pushed the whole page sideways at 375px. The icon carries it there — with
    // an explicit `aria-label`, since a visually hidden label would leave the
    // button with no accessible name at all.
    <Button
      variant="secondary"
      size="sm"
      loading={busy}
      onClick={logout}
      aria-label={t("logout")}
      className="max-sm:px-2.5"
    >
      <svg viewBox="0 0 24 24" aria-hidden className="size-4 sm:hidden">
        <path
          d="M15 17v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v2M19 12H9m10 0-3-3m3 3-3 3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="max-sm:hidden">{t("logout")}</span>
    </Button>
  );
}
