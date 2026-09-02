/**
 * The one cooking session in progress, held on the device.
 *
 * On the device rather than on the server, because the whole point is that it
 * survives a doorbell, a phone call and a dead network — and cooking mode
 * never writes to the recipe, so there is nothing to reconcile. The price is
 * that it does not follow the cook to another device; moving it server-side is
 * a story of its own.
 *
 * Storage throws in a private window, and returns nothing after site data is
 * cleared. Every access here is guarded, and cooking mode has to work with no
 * session at all.
 */

import type { Recipe } from "./api";

const KEY = "fuelr.cooking-session";

/** Older than this and a resume prompt is a lie, not a convenience. */
const MAX_AGE = 12 * 60 * 60 * 1000;

export type StoredTimer = {
  stepIndex: number;
  minutes: number;
  /** Epoch ms it is due; null while paused. */
  endsAt: number | null;
  remaining: number;
  state: "running" | "paused" | "ended";
};

export type CookingSession = {
  recipeId: number;
  title: string;
  /**
   * The recipe itself, copied in.
   *
   * Cooking must not stop because the network did, and a recipe is a few
   * kilobytes. Kept with the session rather than in a store of its own so it
   * has one lifetime: it arrives when cooking starts and leaves when the
   * session does, including on sign-out. It is never written back — cooking
   * mode only ever reads the recipe.
   */
  recipe: Recipe;
  stepIndex: number;
  stepCount: number;
  servings: number;
  /** Ingredient ids ticked off, so the list comes back as it was left. */
  ticked: number[];
  timers: StoredTimer[];
  /** Epoch ms the first step was shown, so "45 min at the stove" is true. */
  startedAt: number;
  updatedAt: number;
};

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    // Blocked by the browser. Not an error: just no session.
    return null;
  }
}

export function readSession(): CookingSession | null {
  const store = storage();
  if (!store) return null;

  try {
    const raw = store.getItem(KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as CookingSession;
    if (typeof session?.recipeId !== "number") return null;
    if (Date.now() - session.updatedAt > MAX_AGE) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    // Written by an older version, or truncated. Treat as no session rather
    // than letting the kitchen screen fail to open.
    return null;
  }
}

export function writeSession(session: Omit<CookingSession, "updatedAt">) {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(KEY, JSON.stringify({ ...session, updatedAt: Date.now() }));
  } catch {
    // Quota, or a browser that allows reading and refuses writing.
  }
}

export function clearSession() {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(KEY);
  } catch {
    // Nothing to do, and nothing worth telling the cook.
  }
}
