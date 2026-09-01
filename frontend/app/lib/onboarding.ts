/**
 * The onboarding answers, kept in the browser until there is an account to
 * attach them to.
 *
 * Someone can type their profile, close the tab, and come back to find it
 * still there — which is the point: the sign-up wall comes after the numbers,
 * so the answers necessarily exist before any account does.
 */
export const STORAGE_KEY = "fuelr.onboarding";

export type Sex = "FEMALE" | "MALE";
export type Activity = "SEDENTARY" | "LIGHT" | "MODERATE" | "ACTIVE" | "VERY_ACTIVE";
export type Goal = "LOSE" | "MAINTAIN" | "GAIN";

export type Draft = {
  goal?: Goal;
  age?: number;
  sex?: Sex;
  heightCm?: number;
  weightKg?: number;
  activity?: Activity;
};

export type Profile = Required<Draft>;

export type Targets = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

/** True once every field the calculation needs has an answer. */
export function isComplete(draft: Draft): draft is Profile {
  return (
    draft.goal !== undefined &&
    draft.age !== undefined &&
    draft.sex !== undefined &&
    draft.heightCm !== undefined &&
    draft.weightKg !== undefined &&
    draft.activity !== undefined
  );
}

export function readDraft(): Draft {
  if (typeof window === "undefined") return {};
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as Draft) : {};
  } catch {
    // Private mode, disabled storage, or something else wrote nonsense under
    // this key. Starting fresh beats refusing to render the page.
    return {};
  }
}

export function writeDraft(draft: Draft) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Not being able to remember is a worse experience, not a broken one.
  }
}

export function clearDraft() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do: the draft is attached to the account either way.
  }
}
