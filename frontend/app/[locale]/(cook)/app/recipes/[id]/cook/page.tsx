import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { apiFetch } from "@app/lib/api";
import type { Recipe } from "@app/lib/api";
import { cookableSteps } from "@app/lib/cooking";
import { CookingMode } from "@app/components/app/cooking-mode";

export const dynamic = "force-dynamic";

export default async function CookPage({
  params,
}: PageProps<"/[locale]/app/recipes/[id]/cook">) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const response = await apiFetch(`/api/recipes/${id}`);
  if (!response.ok) {
    // The backend reports another author's recipe as missing, and so do we.
    notFound();
  }
  const recipe = (await response.json()) as Recipe;

  // A recipe with nothing to follow cannot be cooked. The entry control is
  // already disabled for this, so reaching the URL means it was typed or
  // bookmarked — send them where the missing steps are written, and say so.
  if (cookableSteps(recipe).length === 0) {
    redirect({
      href: { pathname: "/app/recipes/[id]", params: { id }, query: { cook: "no-steps" } },
      locale,
    });
  }

  return <CookingMode recipe={recipe} />;
}
