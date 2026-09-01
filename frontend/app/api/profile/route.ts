import { cookies } from "next/headers";
import { TOKEN_COOKIE } from "@app/lib/session";

function backendUrl() {
  return process.env.BACKEND_INTERNAL_URL ?? "http://backend:8080";
}

/** Attaches the onboarding answers to the account that was just created. */
export async function PUT(request: Request) {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) {
    return new Response(null, { status: 401 });
  }

  const response = await fetch(`${backendUrl()}/api/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: await request.text(),
  });

  return new Response(await response.text(), {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}
