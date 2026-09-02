"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Banner } from "@ui/banner";

const noSubscribe = () => () => {};

/**
 * Says out loud that the page never came alive.
 *
 * When React fails to hydrate, every button renders perfectly and does
 * nothing: a form falls back to a native submit, so the page reloads and the
 * fields empty, with nothing in the console and nothing on screen. No
 * client-side error handler can report that — none of them are running. Only
 * markup the server already sent can, which is what this is.
 *
 * `useSyncExternalStore` returns the server snapshot during hydration and the
 * client one immediately after, so this unmounts the moment React takes over —
 * and stays put forever if it never does.
 */
export function HydrationBanner() {
  const t = useTranslations("system.notInteractive");
  const hydrated = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );

  if (hydrated) {
    return null;
  }

  return (
    <Banner
      tone="error"
      position="fixed"
      title={t("title")}
      data-testid="hydration-banner"
      className="reveal-late"
      action={
        // An anchor, not a button: nothing is listening for a click. An empty
        // href is the current URL, so this reloads with no JavaScript at all.
        <a
          href=""
          className="text-[13px] font-semibold text-accent-ink underline"
        >
          {t("reload")}
        </a>
      }
    >
      {t("body")}
    </Banner>
  );
}
