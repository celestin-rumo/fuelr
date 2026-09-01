import { apiFetch } from "@app/lib/api";

/**
 * Serves a recipe photo through this origin.
 *
 * The token is an httpOnly cookie scoped here, so an <img> pointing straight
 * at the backend would depend on cross-site cookie rules that differ between
 * dev and production. Proxying keeps one behaviour everywhere.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const response = await apiFetch(`/api/recipes/${id}/photo`);

  if (!response.ok) {
    return new Response(null, { status: response.status });
  }

  return new Response(response.body, {
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "image/jpeg",
      "Cache-Control": "private, max-age=60",
    },
  });
}
