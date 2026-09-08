"use client";

import { useEffect, useState } from "react";

/** Every 2.5 s for half a minute: an illustration takes a few seconds, never more. */
const EVERY_MS = 2_500;
const TRIES = 12;

/**
 * Whether a picture drawn for a dish has landed, at a URL that answers 404
 * until it has: a recipe's photo route, or an idea's illustration route.
 *
 * The picture is asked for the instant a dish is proposed or drafted and
 * arrives a few seconds behind it, on the server. Nothing pushes that to the screen,
 * so the screen asks: while a dish a model wrote has no picture yet, the
 * photo route is polled — a HEAD, no body — until it answers 200 or half a
 * minute has passed. Once it has landed nobody asks again; a dish that never
 * gets one stops being asked about too.
 */
export function useIllustration(url: string, awaiting: boolean): boolean {
  const [arrived, setArrived] = useState(false);

  useEffect(() => {
    if (!awaiting || arrived) return;
    let tries = 0;
    let stopped = false;
    const timer = window.setInterval(async () => {
      tries += 1;
      try {
        const response = await fetch(url, {
          method: "HEAD",
          cache: "no-store",
        });
        if (!stopped && response.ok) {
          setArrived(true);
          window.clearInterval(timer);
          return;
        }
      } catch {
        // A failed look is a look; the next tick looks again.
      }
      if (tries >= TRIES) window.clearInterval(timer);
    }, EVERY_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [url, awaiting, arrived]);

  return arrived;
}
