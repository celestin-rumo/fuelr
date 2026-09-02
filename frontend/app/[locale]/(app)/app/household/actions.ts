"use server";

import { apiFetch } from "@app/lib/api";

/**
 * Every action answers with a named outcome rather than a status code, because
 * the screen has something different to say for each of them: a plan that has
 * to be bought, a household that is full, a link that has already been used.
 */

export type InviteResult =
  | { ok: true }
  | { ok: false; reason: "upgrade_required" | "household_full" | "failed" };

export async function inviteMember(email: string, locale: string): Promise<InviteResult> {
  const response = await apiFetch("/api/household/invitations", {
    method: "POST",
    body: JSON.stringify({ email, locale }),
  });
  if (response.ok) return { ok: true };
  if (response.status === 402) return { ok: false, reason: "upgrade_required" };
  if (response.status === 409) return { ok: false, reason: "household_full" };
  return { ok: false, reason: "failed" };
}

export async function revokeInvitation(id: number) {
  const response = await apiFetch(`/api/household/invitations/${id}`, { method: "DELETE" });
  return { ok: response.ok };
}

export type JoinResult =
  | { ok: true }
  | { ok: false; reason: "gone" | "household_full" | "failed" };

export async function joinHousehold(token: string): Promise<JoinResult> {
  const response = await apiFetch("/api/household/join", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
  if (response.ok) return { ok: true };
  // Spent, expired, or pointing at a household that no longer shares — all of
  // them "this link does not work any more" rather than "you may not".
  if (response.status === 410) return { ok: false, reason: "gone" };
  if (response.status === 409) return { ok: false, reason: "household_full" };
  return { ok: false, reason: "failed" };
}

export async function leaveHousehold() {
  const response = await apiFetch("/api/household/leave", { method: "POST" });
  return { ok: response.ok };
}

export async function removeMember(userId: number) {
  const response = await apiFetch(`/api/household/members/${userId}`, { method: "DELETE" });
  return { ok: response.ok };
}

/**
 * Asks for a plan. Where nothing can take the payment this is recorded and
 * goes no further, which is why the screen only offers it when the API says a
 * plan can actually be bought.
 */
export async function orderPlan(tier: "PLUS" | "FAMILY", period: "MONTHLY" | "YEARLY" = "MONTHLY") {
  const response = await apiFetch("/api/subscription/orders", {
    method: "POST",
    body: JSON.stringify({ tier, period }),
  });
  return { ok: response.ok };
}

/** Ends the plan. Nothing is deleted — that is the whole promise. */
export async function cancelPlan() {
  const response = await apiFetch("/api/subscription", { method: "DELETE" });
  return { ok: response.ok };
}
