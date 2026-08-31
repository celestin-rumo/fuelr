import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { apiFetch } from "@app/lib/api";
import type { Recipe } from "@app/lib/api";
import { RecipeEditor } from "@app/components/app/recipe-editor";
import { Container } from "@app/components/site/section";

export const dynamic = "force-dynamic";

export default async function RecipePage({
  params,
}: PageProps<"/[locale]/app/recipes/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const response = await apiFetch(`/api/recipes/${id}`);
  if (!response.ok) {
    // The backend reports another author's recipe as missing, and so do we.
    notFound();
  }
  const recipe = (await response.json()) as Recipe;

  return (
    <Container className="py-12">
      <RecipeEditor recipe={recipe} />
    </Container>
  );
}
