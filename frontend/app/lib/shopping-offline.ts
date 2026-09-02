/**
 * The shopping list, kept on the device.
 *
 * A supermarket basement is the case this exists for: the list has to be
 * readable and tickable with nothing reachable, and the ticks have to arrive
 * once the network does. Two things are stored — the last list seen, and the
 * ticks that have not made it to the server yet.
 *
 * Whether the network is there is never asked. `navigator.onLine` reports that
 * an interface exists, not that anything answers, so the rule here is simpler:
 * try the server, and queue whatever fails. A failed request is a fact.
 *
 * Storage throws in a private window and comes back empty after site data is
 * cleared, so every access is guarded and the screen has to work with nothing
 * stored at all.
 */

import type { ShoppingListView } from "./api";

const LIST_KEY = "fuelr.shopping-list";
const QUEUE_KEY = "fuelr.shopping-queue";

/** Older than this and the list on the device is a guess, not a copy. */
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export type StoredList = {
  week: string;
  savedAt: number;
  list: ShoppingListView;
};

/** One tick, with the instant it happened — not the instant it syncs. */
export type QueuedTick = {
  id: number;
  checked: boolean;
  at: string;
};

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    // Blocked by the browser. Not an error: just no offline copy.
    return null;
  }
}

function read<T>(key: string): T | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    // Written by an older version, or truncated.
    return null;
  }
}

function write(key: string, value: unknown) {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    // Quota, or a browser that allows reading and refuses writing.
  }
}

export function saveList(week: string, list: ShoppingListView) {
  write(LIST_KEY, { week, savedAt: Date.now(), list } satisfies StoredList);
}

export function readList(): StoredList | null {
  const stored = read<StoredList>(LIST_KEY);
  if (!stored?.list?.aisles) return null;
  if (Date.now() - stored.savedAt > MAX_AGE) {
    clearList();
    return null;
  }
  return stored;
}

export function clearList() {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(LIST_KEY);
    store.removeItem(QUEUE_KEY);
  } catch {
    // Nothing to do, and nothing worth telling the shopper.
  }
}

export function readQueue(): QueuedTick[] {
  return read<QueuedTick[]>(QUEUE_KEY) ?? [];
}

/**
 * Remembers a tick the server has not taken yet.
 *
 * One entry per line: ticking the same thing four times in an aisle should
 * send the last answer, not four of them.
 */
export function queueTick(tick: QueuedTick) {
  const queue = readQueue().filter((entry) => entry.id !== tick.id);
  queue.push(tick);
  write(QUEUE_KEY, queue);
}

export function clearQueue() {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(QUEUE_KEY);
  } catch {
    // The ticks will simply be sent again; the server keeps the later one.
  }
}

/** When the copy on the device was taken, for a screen that has no fresher one. */
export function syncedAt(locale: string): string {
  const stored = readList();
  if (!stored) return "";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(stored.savedAt));
}

/**
 * The stored list with the pending ticks applied.
 *
 * What the shopper sees has to include what they just did, even though the
 * server has never heard of it.
 */
export function withQueue(
  list: ShoppingListView,
  queue: QueuedTick[],
): ShoppingListView {
  if (queue.length === 0) return list;
  const pending = new Map(queue.map((tick) => [tick.id, tick]));

  const apply = (item: ShoppingListView["covered"][number]) => {
    const tick = pending.get(item.id);
    return tick
      ? { ...item, checked: tick.checked, checkedAt: tick.checked ? tick.at : null }
      : item;
  };

  const aisles = list.aisles.map((group) => ({
    ...group,
    items: group.items.map(apply),
  }));

  return {
    ...list,
    aisles,
    covered: list.covered.map(apply),
    remaining: aisles.reduce(
      (total, group) => total + group.items.filter((item) => !item.checked).length,
      0,
    ),
  };
}
