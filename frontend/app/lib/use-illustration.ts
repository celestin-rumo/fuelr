"use client";

import { useEffect, useState } from "react";

/** Every 2.5 s for half a minute: an illustration takes a few seconds, never more. */
const EVERY_MS = 2_500;
const TRIES = 12;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Where a proposed dish's picture lives, before it is a recipe. */
export function ideaIllustrationUrl(key: string): string {
  return `/api/ideas/illustrations/${key}`;
}

/**
 * Fetches a proposed dish's picture, waiting for it to be drawn.
 *
 * A GET rather than a HEAD, and the body is read: the picture then sits in
 * the browser's cache, so the row that shows it a moment later paints
 * without a second round trip. That is what lets a whole answer appear at
 * once with its pictures already on it. It gives up after half a minute —
 * a dish whose picture never came shows the tile drawn from its title.
 */
export async function preloadIllustration(key: string, signal?: AbortSignal): Promise<boolean> {
  const url = ideaIllustrationUrl(key);
  for (let tries = 0; tries < TRIES; tries++) {
    if (signal?.aborted) return false;
    try {
      const response = await fetch(url, { signal });
      if (response.ok) {
        await response.blob();
        return true;
      }
    } catch {
      // Aborted, or nothing on the line: no picture, and no noise about it.
      return false;
    }
    await wait(EVERY_MS);
  }
  return false;
}

/**
 * Whether a picture drawn for a dish has landed, at a URL that answers 404
 * until it has: a recipe's photo route, or an idea's illustration route.
 *
 * Asked at once and then every couple of seconds, because the picture is
 * often there already — drawn while the dish after it was being written.
 * Once it has landed nobody asks again; a dish that never gets one stops
 * being asked about too.
 */
export function useIllustration(url: string, awaiting: boolean): boolean {
  const [arrived, setArrived] = useState(false);

  useEffect(() => {
    if (!awaiting || arrived) return;
    let tries = 0;
    let stopped = false;
    let timer = 0;

    async function look() {
      tries += 1;
      try {
        const response = await fetch(url, { method: "HEAD", cache: "no-store" });
        if (!stopped && response.ok) {
          setArrived(true);
          window.clearInterval(timer);
          return;
        }
      } catch {
        // A failed look is a look; the next tick looks again.
      }
      if (tries >= TRIES) window.clearInterval(timer);
    }

    void look();
    timer = window.setInterval(look, EVERY_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [url, awaiting, arrived]);

  return arrived;
}
