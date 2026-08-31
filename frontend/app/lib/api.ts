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
  ingredients: { id: number; name: string; quantity: number; unit: string }[];
  steps: string[];
  tags: string[];
};

export type RecipeSummary = {
  id: number;
  title: string | null;
  status: "DRAFT" | "PUBLISHED";
  servings: number;
  ingredientCount: number;
  stepCount: number;
};
