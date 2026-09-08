import { FoodIcon } from "@ui/food-icons";
import { iconsFor } from "@app/lib/food-words";

/**
 * A small picture at the left of a row.
 *
 * A recipe with a photograph shows it. One without — most imports, every
 * dish a model wrote — gets a tile drawn from its own title: a hue hashed
 * from the words, the first food the title names. Deterministic, so the
 * same recipe looks the same twice and two never look alike; and drawn, not
 * generated, so it never pretends to be a photograph of a dish nobody
 * cooked. The photograph, when it exists, is the only uncontrolled colour
 * on the page — which is the design system's rule for food.
 */
export function RecipeThumb({
  id,
  title,
  hasPhoto,
}: {
  id: number;
  title: string;
  hasPhoto: boolean;
}) {
  if (hasPhoto) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/recipes/${id}/photo`}
        alt=""
        width={44}
        height={44}
        loading="lazy"
        data-testid="recipe-thumb-photo"
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
