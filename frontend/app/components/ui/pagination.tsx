import { IconButton } from "./button";
import { Icon } from "./icons";
import { cn } from "./cn";

/**
 * Previous, where you are, next.
 *
 * No numbered pages: a library is narrowed with the filters above it, not by
 * jumping to page seven of twelve — and a row of numbers is a row of 44px
 * targets that a 360px screen cannot hold once there are more than five of
 * them. What somebody needs to know is which page this is and whether there
 * is another.
 *
 * The position is a sentence rather than "3 / 12", so it is worth reading out
 * loud and does not have to be inferred from punctuation.
 */
export type PaginationProps = {
  /** Zero-based, like the array it is slicing. */
  page: number;
  pages: number;
  onChange: (page: number) => void;
  labels: {
    nav: string;
    previous: string;
    next: string;
    /** "Page 1 of 3 · 14 recipes" — already formatted by the caller. */
    position: string;
  };
  className?: string;
};

export function Pagination({
  page,
  pages,
  onChange,
  labels,
  className,
}: PaginationProps) {
  return (
    <nav
      aria-label={labels.nav}
      data-testid="pagination"
      className={cn("flex items-center justify-center gap-4", className)}
    >
      <IconButton
        aria-label={labels.previous}
        variant="quiet"
        disabled={page <= 0}
        onClick={() => onChange(page - 1)}
      >
        <Icon name="arrowLeft" />
      </IconButton>

      {/* Announced when it changes: pressing "next" moves rows somebody
          cannot see, so the only feedback a screen reader gets is this. */}
      <p
        aria-live="polite"
        data-testid="pagination-position"
        className="tnum text-[13px] font-semibold text-text-dim"
      >
        {labels.position}
      </p>

      <IconButton
        aria-label={labels.next}
        variant="quiet"
        disabled={page >= pages - 1}
        onClick={() => onChange(page + 1)}
      >
        <Icon name="arrowRight" />
      </IconButton>
    </nav>
  );
}
