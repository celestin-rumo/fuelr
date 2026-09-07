function backendUrl() {
  return process.env.BACKEND_INTERNAL_URL ?? "http://backend:8080";
}

/** Makes a new address the login. No session needed: the link is the proof. */
export async function POST(request: Request) {
  const body = await request.text();
  const response = await fetch(`${backendUrl()}/api/auth/verify-email-change`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (!response.ok) {
    return Response.json({ error: "link_expired" }, { status: response.status });
  }
  return Response.json({ ok: true });
}
