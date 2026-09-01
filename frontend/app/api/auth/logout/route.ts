import { cookies } from "next/headers";
import { apiFetch } from "@app/lib/api";
import { TOKEN_COOKIE } from "@app/lib/session";

/**
 * Closes the session on the server, then clears the cookie.
 *
 * The cookie alone is not enough: the token stays valid until it expires, so
 * dropping it locally would leave a working credential behind on anything that
 * copied it. The backend's answer is reported rather than swallowed — an
 * earlier version always returned ok, so a failed revocation looked like a
 * successful sign-out.
 */
export async function POST() {
  const response = await apiFetch("/api/auth/logout", { method: "POST" });

  const jar = await cookies();
  // Cleared even when revocation failed: leaving a signed-in browser behind
  // would be worse. The status still says what really happened.
  jar.delete(TOKEN_COOKIE);
  jar.set(TOKEN_COOKIE, "", { path: "/", maxAge: 0 });

  if (!response.ok) {
    return Response.json({ revoked: false }, { status: response.status });
  }
  return Response.json({ revoked: true });
}
