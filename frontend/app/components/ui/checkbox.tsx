import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type CheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "children"
> & {
  label: ReactNode;
  /** Visual "some but not all" mark, for a parent row over a list. */
  indeterminate?: boolean;
  error?: boolean;
};

export function Checkbox({
  label,
  indeterminate = false,
  error = false,
  className,
  disabled,
  ...props
}: CheckboxProps) {
  return (
    <label
      className={cn(
        "inline-flex items-center gap-3",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
        className,
      )}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        disabled={disabled}
        aria-checked={indeterminate ? "mixed" : undefined}
        {...props}
      />
      <span
        aria-hidden
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-[6px] border-[1.5px]",
          "transition-colors duration-[var(--dur-control)] ease-[var(--ease)]",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--mint-ink)]",
          // Indeterminate is driven by a prop, so it wins outright rather than
          // competing with the :checked variants for the same properties.
          indeterminate
            ? "border-accent bg-accent text-on-accent"
            : cn(
                "border-gray bg-transparent text-transparent",
                "peer-hover:border-accent-ink peer-hover:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]",
                "peer-checked:border-accent peer-checked:bg-accent peer-checked:text-on-accent",
                "peer-disabled:border-line peer-disabled:bg-bg-raised-2",
                // Only a *checked* disabled box shows a (grey) mark.
                "peer-checked:peer-disabled:text-gray",
                error && "border-coral-ink",
              ),
        )}
      >
        {/* Drawn rather than typed: a text glyph would land in the wrapping
            label's text content and corrupt the field's accessible name. */}
        <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {indeterminate ? <path d="M4 8h8" /> : <path d="m3.5 8.5 3 3 6-6" />}
        </svg>
      </span>
      <span
        className={cn(
          "text-[15px] font-medium",
          disabled ? "text-gray" : "text-text",
        )}
      >
        {label}
      </span>
    </label>
  );
}
