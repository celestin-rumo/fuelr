import { apiFetch } from "@app/lib/api";

/**
 * Proxies the export so the browser can download it.
 *
 * The token is an httpOnly cookie scoped to this origin, so the page cannot
 * call the backend directly — this handler carries the credential across and
 * streams the file back under a filename the browser will keep.
 */
export async function GET() {
  const response = await apiFetch("/api/recipes/export");

  if (!response.ok) {
    return new Response(null, { status: response.status });
  }

  return new Response(await response.text(), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="fuelr-recettes.json"',
      // A personal export must never be cached by a proxy on the way.
      "Cache-Control": "no-store",
    },
  });
}
