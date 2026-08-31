import { redirect } from "next/navigation";
import { getPathname } from "@/i18n/navigation";
import { apiFetch } from "@app/lib/api";

// Never prerender: visiting this route has a side effect.
export const dynamic = "force-dynamic";

/**
 * There is no "new recipe" form. Landing here creates the draft and hands the
 * author the editor for a recipe that already exists — so from the very first
 * keystroke there is something to save into, and nothing can be lost.
 */
export default async function NewRecipePage({
  params,
}: PageProps<"/[locale]/app/recipes/new">) {
  const { locale } = await params;

  const response = await apiFetch("/api/recipes", { method: "POST" });
  if (!response.ok) {
    redirect(getPathname({ href: "/app", locale }));
  }

  const recipe = await response.json();
  redirect(getPathname({ href: { pathname: "/app/recipes/[id]", params: { id: String(recipe.id) } }, locale }));
}
