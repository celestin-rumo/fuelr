"use client";

import { useEffect } from "react";

/**
 * Registers the service worker — in production only, and unregisters any it
 * finds anywhere else.
 *
 * The development server rebuilds chunks constantly under the same paths a
 * worker would be caching, and this codebase has already lost an afternoon to
 * an app that rendered perfectly while every script 403'd. So: never in dev,
 * and if one is somehow there — from an e2e build served on the same origin,
 * say — it is removed rather than left to rot.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(registrations.map((one) => one.unregister())),
        )
        .catch(() => {
          // Nothing registered, or the browser refused. Either is fine.
        });
      return;
    }

    // The build is the version: a new one installs a new worker, which drops
    // the caches of the one before it.
    const version = process.env.NEXT_PUBLIC_BUILD_ID ?? "0";
    void navigator.serviceWorker.register(`/sw.js?v=${version}`).catch(() => {
      // An unsupported or locked-down browser. The app works, online.
    });
  }, []);

  return null;
}
