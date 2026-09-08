import { cookies } from "next/headers";
import { TOKEN_COOKIE } from "@app/lib/session";

function backendUrl() {
  return process.env.BACKEND_INTERNAL_URL ?? "http://backend:8080";
}

/**
 * Dishes invented so that the work is shareable.
 *
 * Streamed through as it comes: the backend's server-sent events are the
 * body of this response, untouched, with the headers that stop anything on
 * the way from buffering them into one late piece.
 */
export async function POST(request: Request) {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) {
    return new Response(null, { status: 401 });
  }

  const response = await fetch(`${backendUrl()}/api/plan/suggest/batch/live`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      Authorization: `Bearer ${token}`,
    },
    body: await request.text(),
  });

  if (!response.ok || !response.body) {
    return new Response(null, { status: response.status });
  }
  return new Response(response.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
