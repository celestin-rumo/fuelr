import { cookies } from "next/headers";
import { TOKEN_COOKIE } from "./session";
import type { Slot } from "./week";
import type { Season } from "./seasons";

function backendUrl() {
  return process.env.BACKEND_INTERNAL_URL ?? "http://backend:8080";
}

/**
 * Calls the backend from a Server Component or Route Handler, carrying the
 * caller's token. Session-scoped data is never cached.
 */
export async function apiFetch(path: string, init: RequestInit = {}) {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  return fetch(`${backendUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });
}

export type Recipe = {
  id: number;
  title: string | null;
  description: string | null;
  servings: number;
  level: string | null;
  status: "DRAFT" | "PUBLISHED";
  hasPhoto: boolean;
  ingredients: {
    id: number;
    name: string;
    quantity: number;
    unit: string;
    /** The import could not read this line into a quantity and a unit. */
    needsReview: boolean;
  }[];
  steps: string[];
  tags: string[];
  /** Where an imported recipe came from. Null when it was written by hand. */
  sourceUrl: string | null;
  /** A duration the source stated; otherwise it is inferred from the steps. */
  totalMinutes: number | null;
  /** Field names the import had to guess at: "servings", "steps", "title". */
  unverified: string[];
  /** Zero, one or several. Most recipes are of no season. */
  seasons: Season[];
};

/**
 * One recipe placed on one day. `kcal` is what the planned servings add up to,
 * not what one plate costs — the day total is what the household eats. Null
 * when the recipe carries no ingredients yet.
 */
export type PlannedMeal = {
  id: number;
  date: string;
  slot: Slot;
  position: number;
  recipeId: number;
  title: string | null;
  servings: number;
  /** What the recipe itself is written for, so the scaling is visible. */
  recipeServings: number;
  minutes: number;
  hasPhoto: boolean;
  kcal: number | null;
  estimated: boolean;
  /** Who put it there, and only when that is somebody else. */
  plannedBy: string | null;
  /** Said out loud by somebody; it is what empties the cupboard. */
  cooked: boolean;
};

/** Always seven, empty days included — a missing day would read as a failure. */
export type DayTotals = {
  date: string;
  meals: number;
  kcal: number | null;
};

export type WeekPlan = {
  weekStart: string;
  householdSize: number;
  meals: PlannedMeal[];
  days: DayTotals[];
  /** More than one account is looking at this plan. */
  shared: boolean;
  owner: boolean;
  accounts: number;
};

/**
 * One line of the shopping list. `quantity` is what the week needs, `inStock`
 * what the cupboard holds and `toBuy` the difference — all three travel,
 * because a line that says "buy 300 g" without saying why is not trusted.
 */
export type ShoppingItem = {
  id: number;
  name: string;
  quantity: number | null;
  unit: string;
  aisle: Aisle;
  source: "PLAN" | "MANUAL";
  inStock: number | null;
  toBuy: number | null;
  checked: boolean;
  checkedAt: string | null;
};

export type Aisle =
  | "PRODUCE"
  | "BAKERY"
  | "MEAT_FISH"
  | "DAIRY"
  | "FROZEN"
  | "GROCERY"
  | "HOUSEHOLD"
  | "OTHER";

export type AisleGroup = { aisle: Aisle; items: ShoppingItem[] };

export type ShoppingListView = {
  id: number;
  weekStart: string;
  generatedAt: string;
  /** Already grouped and in the order a shop is walked. */
  aisles: AisleGroup[];
  /** Lines the cupboard already covers. Shown, never bought. */
  covered: ShoppingItem[];
  remaining: number;
};

export type PantryItem = {
  id: number;
  name: string;
  quantity: number;
  unit: string;
  updatedAt: string;
};

export type LogEntry = {
  id: number;
  date: string;
  slot: string;
  title: string;
  servings: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  estimated: boolean;
  source: "PLAN" | "RECIPE" | "FREE";
  recipeId: number | null;
  /** Kept so an undo can put the entry back with its "cooked" mark intact. */
  plannedMealId: number | null;
};

/**
 * One day's total. `logged` says whether anything was written down at all — a
 * blank day is a day nobody recorded, not a day of eating nothing, and the
 * averages are careful about the difference.
 */
export type LogDay = {
  date: string | null;
  logged: boolean;
  meals: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  estimated: boolean;
};

/** `chosen` is false while these are the figures the profile computes. */
export type NutritionTargets = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  chosen: boolean;
};

/** A finding, as a code and its numbers. The wording lives in the catalogue. */
export type Insight = { code: string; values: Record<string, number> };

export type LogWeek = {
  weekStart: string;
  days: LogDay[];
  entries: LogEntry[];
  average: LogDay;
  loggedDays: number;
  targets: NutritionTargets | null;
  insights: Insight[];
  /** Whether the plan that includes targets and findings is paid for. */
  tracking: boolean;
};

export type LogHistory = {
  from: string;
  to: string;
  windowed: boolean;
  windowDays: number;
  earliest: string | null;
  days: LogDay[];
};

/** The paid detail: macros past the four figures, plus what was measured. */
export type NutritionDetail = {
  total: DetailedTotals;
  perServing: DetailedTotals;
  servings: number;
  containsEstimates: boolean;
  micronutrients: { code: string; amount: number; unit: string }[];
  ingredients: {
    name: string;
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    guessed: boolean;
  }[];
};

export type DetailedTotals = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fibreG: number;
  sugarsG: number;
  saltG: number;
};

export type HouseholdMember = {
  userId: number;
  name: string | null;
  email: string;
  owner: boolean;
  you: boolean;
  joinedAt: string | null;
};

export type HouseholdInvitation = {
  id: number;
  email: string;
  expiresAt: string;
};

export type Household = {
  id: number;
  size: number;
  owner: boolean;
  /** Whether the household's owner is currently paying for sharing. */
  sharingOpen: boolean;
  maxAccounts: number;
  members: HouseholdMember[];
  /** Empty for anyone but the owner: nobody else may see who was asked. */
  invitations: HouseholdInvitation[];
};

export type Subscription = {
  tier: "FREE" | "PLUS" | "FAMILY";
  status: "ACTIVE" | "CANCELED";
  period: "MONTHLY" | "YEARLY";
  currentPeriodEnd: string | null;
  features: string[];
  /** False while no plan can actually be paid for. */
  canOrder: boolean;
};

export type RecipeSummary = {
  id: number;
  title: string | null;
  status: "DRAFT" | "PUBLISHED";
  servings: number;
  ingredientCount: number;
  stepCount: number;
  favorite: boolean;
  hasPhoto: boolean;
  minutes: number;
  kcalPerServing: number | null;
  proteinPerServing: number | null;
  carbsPerServing: number | null;
  fatPerServing: number | null;
  estimated: boolean;
  seasons: Season[];
};
