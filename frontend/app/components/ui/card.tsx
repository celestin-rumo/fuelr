import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** Panels use the larger radius and more padding than in-flow cards. */
  as?: "card" | "panel";
  /** Adds the e1 hover elevation used by clickable cards. */
  interactive?: boolean;
  selected?: boolean;
};

export function Card({
  as = "card",
  interactive = false,
  selected = false,
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "border bg-bg-raised",
        // A card never mixes two surface radii.
        as === "panel" ? "rounded-lg p-8" : "rounded-md p-6",
        selected ? "border-accent-ink" : "border-line",
        interactive &&
          "transition-[transform,box-shadow,border-color] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-[3px] hover:border-gray hover:shadow-e1",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "font-display text-base font-bold tracking-[-0.01em] text-text",
        className,
      )}
      {...props}
    />
  );
}

export function CardBody({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "mt-2 max-w-[68ch] text-[15px] leading-[1.5] font-medium text-text-dim",
        className,
      )}
      {...props}
    />
  );
}
