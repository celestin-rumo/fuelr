import { cookies } from "next/headers";
import { TOKEN_COOKIE } from "@app/lib/session";

function backendUrl() {
  return process.env.BACKEND_INTERNAL_URL ?? "http://backend:8080";
}

/**
 * Imports a recipe from a link.
 *
 * The two ways this fails are told apart on purpose, because the screen says
 * something different for each: 502 is a page we could not reach, 422 a page we
 * reached and could not read. Both offer manual entry — a failed import must
 * never be a dead end.
 */
export async function POST(request: Request) {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) {
    return new Response(null, { status: 401 });
  }

  const response = await fetch(`${backendUrl()}/api/recipes/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: await request.text(),
  });

  if (!response.ok) {
    return Response.json(
      { error: response.status === 422 ? "unreadable" : "unreachable" },
      { status: response.status },
    );
  }
  return Response.json(await response.json());
}
