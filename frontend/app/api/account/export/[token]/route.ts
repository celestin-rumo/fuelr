function backendUrl() {
  return process.env.BACKEND_INTERNAL_URL ?? "http://backend:8080";
}

/** Streams the archive through. No session: the link is the proof, and it works once. */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const response = await fetch(`${backendUrl()}/api/account/export/${encodeURIComponent(token)}`);
  if (!response.ok) {
    return new Response(null, { status: response.status });
  }
  return new Response(response.body, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="fuelr-export.zip"',
    },
  });
}
