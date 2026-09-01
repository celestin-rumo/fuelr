import { cookies } from "next/headers";

function backendUrl() {
  return process.env.BACKEND_INTERNAL_URL ?? "http://backend:8080";
}

/**
 * Creates the account and signs the person straight in, so nobody has to type
 * the password they just chose a second time.
 *
 * 409 is passed through untouched: registration is the one place the app may
 * say an address is taken, because the person is at the form and needs to be
 * sent to the login screen. Login and password reset stay silent about it.
 */
export async function POST(request: Request) {
  const body = await request.text();

  const response = await fetch(`${backendUrl()}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": request.headers.get("user-agent") ?? "",
    },
    body,
  });

  if (!response.ok) {
    return Response.json(
      { error: response.status === 409 ? "email_already_used" : "failed" },
      { status: response.status },
    );
  }

  const { token, expiresInSeconds } = await response.json();
  (await cookies()).set("fuelr_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.JWT_SECURE_COOKIE === "true",
    path: "/",
    maxAge: expiresInSeconds,
  });

  return Response.json({ ok: true });
}
