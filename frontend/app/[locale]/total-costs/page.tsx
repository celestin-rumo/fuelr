import { redirect } from "@/i18n/navigation";

/**
 * Where the cost page used to live.
 *
 * It is a section of the operator's panel now. This stays because an operator
 * has the old address in a bookmark, and a bookmark that 404s teaches somebody
 * the page was removed rather than moved.
 *
 * No role check here on purpose: it decides nothing and reveals nothing — the
 * panel it points at answers 404 to anybody who is not an operator, and that
 * is the only place the question needs asking.
 */
export default async function TotalCostsPage({
  params,
}: PageProps<"/[locale]/total-costs">) {
  const { locale } = await params;
  redirect({ href: "/admin/ai-costs", locale });
}
