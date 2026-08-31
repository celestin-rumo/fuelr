import type { ReactNode } from "react";
import { cn } from "./cn";

export type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  /** Uses the alert tone for a failure rather than an empty collection. */
  tone?: "neutral" | "error";
  className?: string;
};

export function EmptyState({
  icon,
  title,
  body,
  action,
  tone = "neutral",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-md border border-line bg-bg-raised px-6 py-12 text-center",
        className,
      )}
    >
      {icon && (
        <div
          aria-hidden
          className={cn(
            "mb-4 grid size-12 place-items-center rounded-full text-xl",
            tone === "error"
              ? "bg-[color-mix(in_srgb,var(--coral)_18%,transparent)] text-coral-ink"
              : "bg-bg-raised-2 text-text-dim",
          )}
        >
          {icon}
        </div>
      )}
      <h3 className="font-display text-base font-bold text-text">{title}</h3>
      {body && (
        <p className="mt-2 max-w-[46ch] text-[15px] leading-[1.5] font-medium text-text-dim">
          {body}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
