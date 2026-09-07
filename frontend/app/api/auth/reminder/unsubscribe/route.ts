function backendUrl() {
  return process.env.BACKEND_INTERNAL_URL ?? "http://backend:8080";
}

/** Stops the weekly reminder. No session needed: the link is the proof. */
export async function POST(request: Request) {
  const body = await request.text();
  const response = await fetch(`${backendUrl()}/api/auth/reminder/unsubscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  return new Response(null, { status: response.ok ? 204 : response.status });
}
