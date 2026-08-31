import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type RadioProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "children"
> & {
  label: ReactNode;
};

export function Radio({ label, className, disabled, ...props }: RadioProps) {
  return (
    <label
      className={cn(
        "inline-flex items-center gap-3",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
        className,
      )}
    >
      <input type="radio" className="peer sr-only" disabled={disabled} {...props} />
      <span
        aria-hidden
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] border-gray",
          "transition-colors duration-[var(--dur-control)] ease-[var(--ease)]",
          "peer-hover:border-accent-ink peer-hover:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--mint-ink)]",
          "peer-checked:border-accent-ink",
          "peer-disabled:border-line peer-disabled:bg-bg-raised-2",
          // The dot is a grandchild of the peer, so the sibling combinator
          // has to be aimed at it explicitly.
          "peer-checked:[&>span]:bg-accent",
          "peer-disabled:[&>span]:bg-transparent",
          "peer-checked:peer-disabled:[&>span]:bg-gray",
        )}
      >
        <span className="size-2.5 rounded-full bg-transparent" />
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
