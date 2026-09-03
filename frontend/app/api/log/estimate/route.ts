import { cookies } from "next/headers";
import { TOKEN_COOKIE } from "@app/lib/session";

function backendUrl() {
  return process.env.BACKEND_INTERNAL_URL ?? "http://backend:8080";
}

/**
 * Estimates a plate from a photograph, and writes nothing.
 *
 * The refusals are told apart because the screen says something different for
 * each: a plan that is missing, a month that is spent, a plate the model could
 * not recognise, and a reader that is not wired.
 */
export async function POST(request: Request) {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) {
    return new Response(null, { status: 401 });
  }

  const response = await fetch(`${backendUrl()}/api/log/estimate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      // Carries the multipart boundary; rebuilding it by hand loses it.
      "Content-Type": request.headers.get("content-type") ?? "",
    },
    body: await request.arrayBuffer(),
  });

  if (response.ok) {
    return Response.json(await response.json());
  }

  const errors: Record<number, string> = {
    402: "upgrade_required",
    413: "file_too_large",
    415: "unsupported_format",
    422: "not_recognised",
    429: "ai_budget_exhausted",
    503: "ai_unavailable",
  };
  return Response.json(
    { error: errors[response.status] ?? "provider" },
    { status: response.status },
  );
}
