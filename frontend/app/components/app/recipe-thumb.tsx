"use client";

import { useTranslations } from "next-intl";
import { FoodIcon } from "@ui/food-icons";
import { iconsFor } from "@app/lib/food-words";

/**
 * A small picture at the left of a row.
 *
 * A recipe with a photograph shows it. A dish a model wrote gets one drawn
 * by an image model a few seconds after it is accepted, and the picture
 * says so on hover — it is an illustration, not a photograph of a dish
 * somebody cooked. Until it lands, and for every recipe with no picture at
 * all, a tile drawn from the title: a hue hashed from the words, the first
 * food the title names, the same every time. The photograph, when it
 * exists, is the only uncontrolled colour on the page — which is the design
 * system's rule for food.
 */
export function RecipeThumb({
  id,
  title,
  hasPhoto,
  generated = false,
}: {
  id: number;
  title: string;
  hasPhoto: boolean;
  generated?: boolean;
}) {
  const t = useTranslations("recipe.photo");
  if (hasPhoto) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/recipes/${id}/photo`}
        alt=""
        title={generated ? t("generated") : undefined}
        width={44}
        height={44}
        loading="lazy"
        data-testid={generated ? "recipe-thumb-illustration" : "recipe-thumb-photo"}
        className="size-11 shrink-0 rounded-sm object-cover"
      />
    );
  }
  const hue = hueOf(title);
  const icon = iconsFor(title)[0];
  return (
    <span
      aria-hidden="true"
      data-testid="recipe-thumb-tile"
      className="grid size-11 shrink-0 place-items-center rounded-sm text-text"
      style={{ background: `hsl(${hue} 32% 40% / 0.35)` }}
    >
      <FoodIcon name={icon} size={22} />
    </span>
  );
}

/** A hue from the title, the same every time. */
function hueOf(text: string): number {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}
