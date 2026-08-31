import { cn } from "./cn";

/**
 * Inline loading indicator. Inherits the current text colour.
 *
 * Decorative by default: the control that owns it announces the busy state
 * (`Button` sets `aria-busy`), so giving the spinner its own live region would
 * duplicate the announcement. Pass a `label` only when it stands alone.
 */
export function Spinner({
  className,
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        "inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}
