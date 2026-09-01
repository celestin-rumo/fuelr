import { cookies } from "next/headers";
import { TOKEN_COOKIE } from "@app/lib/session";

function backendUrl() {
  return process.env.BACKEND_INTERNAL_URL ?? "http://backend:8080";
}

/** Sends the confirmation email again, for the banner's action. */
export async function POST(request: Request) {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) {
    return new Response(null, { status: 401 });
  }

  const locale = new URL(request.url).searchParams.get("locale") ?? "fr";
  const response = await fetch(
    `${backendUrl()}/api/auth/verify-email/resend?locale=${locale}`,
    { method: "POST", headers: { Authorization: `Bearer ${token}` } },
  );

  return new Response(null, { status: response.ok ? 204 : response.status });
}
