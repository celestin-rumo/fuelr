function backendUrl() {
  return process.env.BACKEND_INTERNAL_URL ?? "http://backend:8080";
}

/**
 * Sets the new password. Unlike forgot-password, the outcome here is worth
 * reporting: the person is holding a link that either still works or does not,
 * and a silent success would leave them unable to sign in.
 */
export async function POST(request: Request) {
  const body = await request.text();

  const response = await fetch(`${backendUrl()}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!response.ok) {
    return Response.json(
      { error: response.status === 410 ? "link_expired" : "invalid_password" },
      { status: response.status },
    );
  }

  return Response.json({ ok: true });
}
