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
    <Button variant="secondary" size="sm" loading={busy} onClick={logout}>
      {t("logout")}
    </Button>
  );
}
