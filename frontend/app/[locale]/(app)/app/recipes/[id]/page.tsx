import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { apiFetch } from "@app/lib/api";
import type { Recipe } from "@app/lib/api";
import { RecipeEditor } from "@app/components/app/recipe-editor";
import { Container } from "@app/components/site/section";

export const dynamic = "force-dynamic";

export default async function RecipePage({
  params,
  searchParams,
}: PageProps<"/[locale]/app/recipes/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  // Cooking mode redirects here when a recipe has nothing to follow, and says
  // so through the URL so the reason survives the redirect.
  const { cook } = await searchParams;
  const notice = cook === "no-steps" ? ("no-steps" as const) : undefined;

  const response = await apiFetch(`/api/recipes/${id}`);
  if (!response.ok) {
    // The backend reports another author's recipe as missing, and so do we.
    notFound();
  }
  const recipe = (await response.json()) as Recipe;

  return (
    <Container className="py-12">
      <RecipeEditor recipe={recipe} notice={notice} />
    </Container>
  );
}
