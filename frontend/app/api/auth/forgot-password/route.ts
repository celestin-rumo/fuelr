function backendUrl() {
  return process.env.BACKEND_INTERNAL_URL ?? "http://backend:8080";
}

/**
 * Asks for a reset link.
 *
 * Answers 204 whatever happens, including when the backend is down. The screen
 * behind this must not become a way to find out which addresses have an
 * account, and an error shown for one address but not another would do exactly
 * that.
 */
export async function POST(request: Request) {
  const body = await request.text();

  await fetch(`${backendUrl()}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  }).catch(() => null);

  return new Response(null, { status: 204 });
}
