import { cookies } from "next/headers";
import { TOKEN_COOKIE } from "@app/lib/session";

function backendUrl() {
  return process.env.BACKEND_INTERNAL_URL ?? "http://backend:8080";
}

/**
 * Asks what to cook from what somebody has.
 *
 * Never refuses for want of a plan: the library is searched for free and
 * answers most of the time, and the ideas beyond it are declined quietly
 * rather than turned into a sales pitch.
 */
export async function POST(request: Request) {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) {
    return new Response(null, { status: 401 });
  }

  const response = await fetch(`${backendUrl()}/api/menu/suggestions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: await request.text(),
  });

  if (!response.ok) {
    return Response.json({ error: "failed" }, { status: response.status });
  }
  return Response.json(await response.json());
}
