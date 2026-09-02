import { cookies } from "next/headers";
import { TOKEN_COOKIE } from "./session";

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
};
