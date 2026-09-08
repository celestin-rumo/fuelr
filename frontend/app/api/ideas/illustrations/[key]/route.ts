import { apiFetch } from "@app/lib/api";

/**
 * The picture drawn for a proposed dish, by the key the proposal carries.
 * 404 until it has landed — which is what the screen polls for.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const response = await apiFetch(`/api/ideas/illustrations/${encodeURIComponent(key)}`);
  if (!response.ok) {
    return new Response(null, { status: response.status });
  }
  return new Response(response.body, {
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "image/jpeg",
      "Cache-Control": "private, max-age=600",
    },
  });
}
