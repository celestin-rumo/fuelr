import { cookies } from "next/headers";

/** Name of the httpOnly cookie the backend sets on login. */
export const TOKEN_COOKIE = "fuelr_token";

export type Session = {
  id: number;
  email: string;
  name: string | null;
  role: string;
};

/**
 * Base URL used for server-to-server calls. Inside Docker the frontend reaches
 * the backend by service name, which is not the URL a browser would use.
 */
function backendUrl() {
  return process.env.BACKEND_INTERNAL_URL ?? "http://backend:8080";
}

/**
 * Asks the backend who the caller is.
 *
 * This is the real check: the middleware can only see whether a cookie exists,
 * and a cookie is trivially forged. Only the backend can say whether the token
 * inside it is signed, unexpired and belongs to a live account — so every
 * protected page resolves the session here, on the server, before rendering.
 *
 * Returns null when there is no valid session, for any reason.
 */
export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) return null;

  try {
    const response = await fetch(`${backendUrl()}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      // A session check must never be served from a cache.
      cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json()) as Session;
  } catch {
    // Backend unreachable: treat as unauthenticated rather than letting the
    // page render with no session behind it.
    return null;
  }
}
