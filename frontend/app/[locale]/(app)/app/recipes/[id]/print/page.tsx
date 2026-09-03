import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { apiFetch } from "@app/lib/api";
import type { Recipe } from "@app/lib/api";
import { PrintPage } from "@app/components/app/print-page";
import { RecipePrint } from "@app/components/app/recipe-print";

export const dynamic = "force-dynamic";

/**
 * The recipe, as a sheet of paper.
 *
 * Read from the server rather than from the editor's draft: an autosaved
 * editor and this page are never more than a moment apart, and a sheet that
 * printed something the database does not hold would be worse than one that
 * lags a second.
 */
export default async function RecipePrintPage({
  params,
}: PageProps<"/[locale]/app/recipes/[id]/print">) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const response = await apiFetch(`/api/recipes/${id}`);
  if (!response.ok) {
    // The backend reports another author's recipe as missing, and so do we.
    notFound();
  }
  const recipe = (await response.json()) as Recipe;

  return (
    <PrintPage>
      <RecipePrint
        recipe={{
          title: recipe.title,
          description: recipe.description,
          servings: recipe.servings,
          totalMinutes: recipe.totalMinutes,
          sourceUrl: recipe.sourceUrl,
          unverified: recipe.unverified,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
        }}
      />
    </PrintPage>
  );
}
