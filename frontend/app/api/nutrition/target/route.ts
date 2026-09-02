function backendUrl() {
  return process.env.BACKEND_INTERNAL_URL ?? "http://backend:8080";
}

/**
 * The preview. No session, by design: the numbers are what convince someone
 * to make an account, so they cannot sit behind one.
 */
export async function POST(request: Request) {
  const response = await fetch(`${backendUrl()}/api/nutrition/target`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: await request.text(),
  });

  return new Response(await response.text(), {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
