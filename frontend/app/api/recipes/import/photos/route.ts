import { cookies } from "next/headers";
import { TOKEN_COOKIE } from "@app/lib/session";

function backendUrl() {
  return process.env.BACKEND_INTERNAL_URL ?? "http://backend:8080";
}

/**
 * Imports a recipe from photos or screenshots.
 *
 * The multipart body is passed straight through — reading it here to build a
 * new one would double every image in memory for no gain. What is not passed
 * through is the reason for a refusal: the backend answers 402 when the plan
 * is missing and 503 when nothing is wired, and the screen says something
 * different for each, so each gets its own code.
 */
export async function POST(request: Request) {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) {
    return new Response(null, { status: 401 });
  }

  const source = new URL(request.url).searchParams.get("source") ?? "PHOTO";
  const response = await fetch(
    `${backendUrl()}/api/recipes/import/photos?source=${encodeURIComponent(source)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        // Carries the multipart boundary; rebuilding it by hand loses it.
        "Content-Type": request.headers.get("content-type") ?? "",
      },
      body: await request.arrayBuffer(),
    },
  );

  if (response.ok) {
    return Response.json(await response.json());
  }

  const errors: Record<number, string> = {
    402: "upgrade_required",
    413: "file_too_large",
    415: "unsupported_format",
    422: "unreadable",
    429: "ai_budget_exhausted",
    502: "provider",
    503: "ai_unavailable",
  };
  return Response.json(
    { error: errors[response.status] ?? "unreachable" },
    { status: response.status },
  );
}
