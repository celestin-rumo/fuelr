import { cookies } from "next/headers";

function backendUrl() {
  return process.env.BACKEND_INTERNAL_URL ?? "http://backend:8080";
}

/**
 * Signs in through this origin.
 *
 * The form cannot call the backend directly: in development it sits on another
 * port, so the browser would refuse the cross-origin request, and the session
 * cookie has to be set here anyway. This handler forwards the credentials and
 * keeps the token out of any client-side JavaScript.
 */
export async function POST(request: Request) {
  const body = await request.text();

  const response = await fetch(`${backendUrl()}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Lets the backend label the session with something recognisable.
      "User-Agent": request.headers.get("user-agent") ?? "",
    },
    body,
  });

  if (!response.ok) {
    return Response.json(
      {
        error: response.status === 429 ? "too_many_attempts" : "invalid_credentials",
        retryAfter: response.headers.get("Retry-After"),
      },
      { status: response.status },
    );
  }

  const { token, expiresInSeconds } = await response.json();
  (await cookies()).set("fuelr_token", token, {
    httpOnly: true,
    sameSite: "lax",
    // Same switch the backend uses, rather than a second policy derived from
    // the build mode: one cookie should not have two authorities deciding
    // whether it is HTTPS-only.
    secure: process.env.JWT_SECURE_COOKIE === "true",
    path: "/",
    maxAge: expiresInSeconds,
  });

  return Response.json({ ok: true });
}
