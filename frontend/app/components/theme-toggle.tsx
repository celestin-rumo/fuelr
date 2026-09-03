"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Button } from "@ui/button";

const subscribe = () => () => {};

export function ThemeToggle() {
  const t = useTranslations("theme");
  const { resolvedTheme, setTheme } = useTheme();

  // The resolved theme is only known client-side, so the label stays empty
  // until after hydration to keep the server and client markup identical.
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="secondary"
      size="sm"
      // Icon only on a phone: a preference nobody touches twice a month was
      // taking 96px of the most expensive row on the screen. The name is on
      // the button either way, so nothing is lost to a screen reader.
      className="max-sm:w-11 max-sm:px-0 sm:min-w-24"
      aria-label={t("toggle")}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      <span aria-hidden className="sm:hidden">
        {mounted ? (isDark ? "☀" : "☾") : ""}
      </span>
      <span className="max-sm:hidden">
        {mounted ? (isDark ? t("light") : t("dark")) : ""}
      </span>
    </Button>
  );
}
