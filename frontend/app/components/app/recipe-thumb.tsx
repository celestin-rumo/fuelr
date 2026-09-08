"use client";

import { useTranslations } from "next-intl";
import { FoodIcon } from "@ui/food-icons";
import { iconsFor } from "@app/lib/food-words";
import { useIllustration } from "@app/lib/use-illustration";

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
  awaiting = false,
}: {
  id: number;
  title: string;
  hasPhoto: boolean;
  generated?: boolean;
  /** A dish a model wrote, whose picture is still being drawn. */
  awaiting?: boolean;
}) {
  const t = useTranslations("recipe.photo");
  // The picture is a few seconds behind the draft; the row watches for it
  // rather than waiting for somebody to reload.
  const arrived = useIllustration(`/api/recipes/${id}/photo`, awaiting && !hasPhoto);
  if (arrived) {
    hasPhoto = true;
    generated = true;
  }
  if (hasPhoto) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/recipes/${id}/photo${arrived ? "?v=1" : ""}`}
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
  return <TitleTile title={title} />;
}

/**
 * The tile drawn from a title: a hue hashed from the words, the first food
 * the title names. The same every time, and never a photograph of anything.
 */
export function TitleTile({ title, size = 44 }: { title: string; size?: number }) {
  const hue = hueOf(title);
  const icon = iconsFor(title)[0];
  return (
    <span
      aria-hidden="true"
      data-testid="recipe-thumb-tile"
      className="grid shrink-0 place-items-center rounded-sm text-text"
      style={{ width: size, height: size, background: `hsl(${hue} 32% 40% / 0.35)` }}
    >
      <FoodIcon name={icon} size={Math.round(size / 2)} />
    </span>
  );
}

/**
 * A picture for a dish that is only proposed, drawn while the model is
 * still writing the others. It has no recipe yet, so it is fetched by the
 * key the server gave it, and polled for until it lands; before that, and
 * for a proposal that never gets one, the tile from the title.
 */
export function IdeaThumb({
  illustrationKey,
  title,
  size = 44,
}: {
  illustrationKey: string | null | undefined;
  title: string;
  size?: number;
}) {
  const t = useTranslations("recipe.photo");
  const url = illustrationKey ? `/api/ideas/illustrations/${illustrationKey}` : "";
  const arrived = useIllustration(url, Boolean(illustrationKey));
  if (arrived) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        title={t("generated")}
        width={size}
        height={size}
        loading="lazy"
        data-testid="idea-thumb-illustration"
        className="shrink-0 rounded-sm object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return <TitleTile title={title} size={size} />;
}

/** A hue from the title, the same every time. */
function hueOf(text: string): number {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}
