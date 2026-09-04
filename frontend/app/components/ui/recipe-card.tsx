import { cn } from "./cn";
import { Icon } from "./icons";
import { Badge } from "./badge";

export type RecipeCardProps = {
  title: string;
  /** e.g. "4 personnes · 25 min" — meta is 13px semibold. */
  meta: string;
  /** Quantities and energy go in mono with tabular figures. */
  data?: string;
  tag?: string;
  favorite?: boolean;
  selected?: boolean;
  /** Dims the card and blocks interaction. */
  unavailable?: boolean;
  onToggleFavorite?: () => void;
  className?: string;
};

export function RecipeCard({
  title,
  meta,
  data,
  tag,
  favorite = false,
  selected = false,
  unavailable = false,
  onToggleFavorite,
  className,
}: RecipeCardProps) {
  return (
    <article
      // `article` has no aria-disabled; the card is taken out of the flow of
      // interaction with pointer-events instead.
      data-unavailable={unavailable || undefined}
      className={cn(
        "group relative overflow-hidden rounded-md border bg-bg-raised",
        "transition-[transform,box-shadow,border-color] duration-[var(--dur)] ease-[var(--ease)]",
        selected ? "border-accent-ink" : "border-line",
        unavailable
          ? "pointer-events-none opacity-55"
          : "hover:-translate-y-[3px] hover:border-gray hover:shadow-e1",
        className,
      )}
    >
      {/* Photo placeholder: the UI stays neutral so the food is the only
          uncontrolled colour. */}
      <div className="relative aspect-[4/3] overflow-hidden bg-bg-raised-2">
        <div
          aria-hidden
          className="size-full bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent)_22%,transparent),color-mix(in_srgb,var(--mint)_18%,transparent))] transition-transform duration-[var(--dur)] ease-[var(--ease)] group-hover:scale-[1.04]"
        />

        {tag && (
          <span className="absolute top-3 left-3">
            <Badge tone="solid">{tag}</Badge>
          </span>
        )}

        {onToggleFavorite && (
          <button
            type="button"
            aria-label={favorite ? "Remove from favourites" : "Add to favourites"}
            aria-pressed={favorite}
            onClick={onToggleFavorite}
            className={cn(
              "absolute top-3 right-3 grid size-11 place-items-center rounded-full text-sm",
              "transition-colors duration-[var(--dur-fast)] ease-[var(--ease)]",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]",
              favorite
                ? "bg-accent text-on-accent"
                : "bg-[rgba(18,18,18,0.55)] text-[#f5f5f0] hover:bg-[rgba(18,18,18,0.75)]",
            )}
          >
            <Icon name="star" size={20} filled={favorite} />
          </button>
        )}

        {selected && (
          <span
            aria-hidden
            className="absolute bottom-3 left-3 grid size-7 place-items-center rounded-full bg-accent text-sm font-bold text-on-accent"
          >
            <Icon name="check" size={16} />
          </span>
        )}
      </div>

      <div className="p-4">
        <h3
          className={cn(
            "font-display text-base font-bold tracking-[-0.01em]",
            unavailable ? "text-text-dim" : "text-text",
          )}
        >
          {title}
        </h3>
        <p className="mt-1 text-[13px] font-semibold text-text-dim">{meta}</p>
        {data && (
          <p className="tnum mt-2 font-mono text-[13px] text-gray">{data}</p>
        )}
      </div>
    </article>
  );
}
