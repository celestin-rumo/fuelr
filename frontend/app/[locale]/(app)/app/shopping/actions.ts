"use server";

import { apiFetch } from "@app/lib/api";
import type { PantryItem, ShoppingListView } from "@app/lib/api";

/**
 * Every one of these answers with the whole list, because the server rebuilds
 * it from the plan on each read: after a tick, an addition or a sync, the
 * screen has one shape to render and never has to patch its own copy.
 *
 * They fail rather than throw only where the caller can do something about it.
 * A tick made with no network throws, and that is on purpose — the screen
 * queues whatever fails, which is a fact about the network rather than a guess.
 */

export async function checkItem(id: number, checked: boolean, at: string) {
  const response = await apiFetch(`/api/shopping/items/${id}`, {
    method: "PUT",
    body: JSON.stringify({ checked, at }),
  });
  if (!response.ok) throw new Error("check_failed");
  return (await response.json()) as ShoppingListView;
}

export async function addItem(
  week: string,
  item: { name: string; quantity?: number; unit?: string },
) {
  const response = await apiFetch(`/api/shopping/items?week=${week}`, {
    method: "POST",
    body: JSON.stringify(item),
  });
  return { ok: response.ok };
}

export async function removeItem(id: number) {
  const response = await apiFetch(`/api/shopping/items/${id}`, { method: "DELETE" });
  return { ok: response.ok };
}

/** One flush of everything ticked while the network was gone. */
export async function syncTicks(
  week: string,
  items: { id: number; checked: boolean; at: string }[],
) {
  const response = await apiFetch(`/api/shopping/sync?week=${week}`, {
    method: "POST",
    body: JSON.stringify({ items }),
  });
  if (!response.ok) throw new Error("sync_failed");
  return (await response.json()) as ShoppingListView;
}

export async function stockItem(item: { name: string; quantity: number; unit: string }) {
  const response = await apiFetch("/api/pantry", {
    method: "PUT",
    body: JSON.stringify(item),
  });
  if (!response.ok) return { ok: false as const };
  return { ok: true as const, item: (await response.json()) as PantryItem };
}

export async function unstockItem(id: number) {
  const response = await apiFetch(`/api/pantry/${id}`, { method: "DELETE" });
  return { ok: response.ok };
}
