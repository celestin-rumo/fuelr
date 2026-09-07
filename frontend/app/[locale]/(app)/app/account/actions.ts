"use server";

import { apiFetch } from "@app/lib/api";
import type { DietaryPreferences, ProfileInput, ProfileResponse, Reminder, WeightEntry } from "@app/lib/api";

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

/** Replaced whole: there is only ever one set of preferences per account. */
export async function savePreferences(input: DietaryPreferences) {
  const response = await apiFetch("/api/preferences", {
    method: "PUT",
    body: JSON.stringify(input),
  });
  if (!response.ok) return { ok: false as const };
  return { ok: true as const, saved: (await response.json()) as DietaryPreferences };
}

/** Closes one device that is not this one; this one closes through sign-out. */
export async function closeSession(id: string) {
  const response = await apiFetch(`/api/auth/sessions/${id}`, { method: "DELETE" });
  return { ok: response.ok };
}

export async function closeOtherSessions() {
  const response = await apiFetch("/api/auth/sessions", { method: "DELETE" });
  return { ok: response.ok };
}

/** Asks for the archive. It is built in the background and a mail brings the link. */
export async function requestExport(locale: string) {
  const response = await apiFetch("/api/account/export", {
    method: "POST",
    body: JSON.stringify({ locale }),
  });
  return { ok: response.ok };
}

export type DeletionPreview = {
  recipes: number;
  photos: number;
  householdHandedOver: boolean;
  newOwnerEmail: string | null;
};

/** What deleting would do, from what the server reports. */
export async function previewDeletion(): Promise<DeletionPreview | null> {
  const response = await apiFetch("/api/account/deletion");
  return response.ok ? response.json() : null;
}

export async function deleteAccount(password: string): Promise<PasswordResult> {
  const response = await apiFetch("/api/account", {
    method: "DELETE",
    body: JSON.stringify({ password }),
  });
  if (response.ok) return { ok: true };
  return { ok: false, reason: response.status === 400 ? "wrong" : "failed" };
}

/** Off with `day: null`; the hour defaults to 18 on the server. */
export async function setReminder(input: { day: number | null; hour: number | null }) {
  const response = await apiFetch("/api/account/reminder", {
    method: "PUT",
    body: JSON.stringify(input),
  });
  if (!response.ok) return { ok: false as const };
  return { ok: true as const, reminder: (await response.json()) as Reminder };
}
