import { useEffect } from "react";

/**
 * Keeps the screen on while cooking mode is open.
 *
 * The browser releases the lock every time the tab hides, so acquiring it once
 * is the bug that looks like it works: the screen stays on until the first
 * notification, then never again. Re-acquiring on `visibilitychange` is the
 * whole point of this hook.
 *
 * Where the API is missing — or refused, on a low battery — nothing throws and
 * nothing in the UI promises a screen that stays on.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let dropped = false;

    async function acquire() {
      if (sentinel && !sentinel.released) return;
      try {
        const next = await navigator.wakeLock.request("screen");
        // The effect may already have been torn down while we awaited.
        if (dropped) {
          void next.release();
          return;
        }
        sentinel = next;
      } catch {
        // Low battery, or an OS policy. The page is unchanged either way.
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible") void acquire();
    }

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      dropped = true;
      document.removeEventListener("visibilitychange", onVisibility);
      // Leaving cooking mode gives the screen back. Nothing holds a lock for a
      // page the cook is no longer looking at.
      if (sentinel && !sentinel.released) void sentinel.release();
      sentinel = null;
    };
  }, [active]);
}
