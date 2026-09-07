"use server";

import { apiFetch } from "@app/lib/api";
import type { ProfileInput, ProfileResponse, WeightEntry } from "@app/lib/api";

/**
 * Every action here answers `{ ok }` or a named refusal rather than throwing:
 * the account page is a set of small forms, and a failed one has to keep its
 * fields and say what happened, not become an error page.
 */

export async function updateAccount(input: { name?: string; locale?: string }) {
  const response = await apiFetch("/api/account", {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return { ok: response.ok };
}

export type PasswordResult = { ok: true } | { ok: false; reason: "wrong" | "failed" };

export async function changePassword(input: {
  current: string;
  next: string;
  locale: string;
}): Promise<PasswordResult> {
  const response = await apiFetch("/api/account/password", {
    method: "PUT",
    body: JSON.stringify(input),
  });
  if (response.ok) return { ok: true };
  return { ok: false, reason: response.status === 400 ? "wrong" : "failed" };
}

/**
 * Asks to move the account to another address. 202 says the mails are on
 * their way and nothing else — whether the address is free is between the
 * mail and its reader, as it is at registration.
 */
export async function requestEmailChange(input: {
  email: string;
  password: string;
  locale: string;
}): Promise<PasswordResult> {
  const response = await apiFetch("/api/account/email", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (response.ok) return { ok: true };
  return { ok: false, reason: response.status === 400 ? "wrong" : "failed" };
}

/** The six figures, replaced whole: there is only ever one profile per account. */
export async function saveProfile(
  input: ProfileInput,
): Promise<{ ok: true; saved: ProfileResponse } | { ok: false }> {
  const response = await apiFetch("/api/profile", {
    method: "PUT",
    body: JSON.stringify(input),
  });
  if (!response.ok) return { ok: false };
  return { ok: true, saved: await response.json() };
}

/** What the six figures would give, before any of them is written. */
export async function previewTargets(input: ProfileInput) {
  const response = await apiFetch("/api/nutrition/target", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!response.ok) return null;
  return (await response.json()) as ProfileResponse["targets"];
}

/** One figure a day: weighing twice replaces rather than appends. */
export async function recordWeight(input: { weighedOn: string; weightKg: number }) {
  const response = await apiFetch("/api/weight", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!response.ok) return { ok: false as const };
  return { ok: true as const, entry: (await response.json()) as WeightEntry };
}

/** No confirmation: a weigh-in is frequent and exactly recreatable, so undo. */
export async function removeWeight(id: number) {
  const response = await apiFetch(`/api/weight/${id}`, { method: "DELETE" });
  return { ok: response.ok };
}
