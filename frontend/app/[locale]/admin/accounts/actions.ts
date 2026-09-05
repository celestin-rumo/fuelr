"use server";

import { apiFetch } from "@app/lib/api";
import type { AdminDeletionPreview } from "@app/lib/api";

/**
 * The two things an operator can do to somebody else's account.
 *
 * Both answer `{ ok }` rather than throwing: this is a panel somebody uses at
 * speed with an email open beside it, and a failure has to say so in the row
 * rather than replace the screen with an error page.
 */
export async function setTier(userId: number, tier: string, reason: string) {
  const response = await apiFetch(`/api/admin/accounts/${userId}/tier`, {
    method: "POST",
    body: JSON.stringify({ tier, reason }),
  });
  return { ok: response.ok };
}

export async function previewDeletion(
  userId: number,
): Promise<{ ok: true; preview: AdminDeletionPreview } | { ok: false }> {
  const response = await apiFetch(`/api/admin/accounts/${userId}/deletion-preview`);
  if (!response.ok) return { ok: false };
  return { ok: true, preview: (await response.json()) as AdminDeletionPreview };
}

export async function deleteAccount(userId: number) {
  const response = await apiFetch(`/api/admin/accounts/${userId}`, {
    method: "DELETE",
  });
  return { ok: response.ok };
}
