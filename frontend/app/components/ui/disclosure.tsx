"use client";

import type { ReactNode } from "react";
import { cn } from "./cn";
import { Icon } from "./icons";

/**
 * A block that opens.
 *
 * A native `<details>`, so it works with no script, the keyboard reaches
 * it, and a screen reader announces its state — the `summary` carries the
 * 44px floor a phone needs and the chevron turns with the state. It is for
 * a form somebody uses now and then: on a page of nine forms, the six that
 * are touched twice a year stay shut, and the page stops being a scroll.
 *
 * Not for content that must be read: a hidden warning is no warning.
 */
export function Disclosure({
  title,
  hint,
  defaultOpen = false,
  children,
  className,
  ...props
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDetailsElement>, "title" | "children">) {
  return (
    <details
      open={defaultOpen}
      className={cn("group rounded-md border border-line bg-bg-raised", className)}
      {...props}
    >
      <summary className="flex min-h-[4.5rem] cursor-pointer list-none items-center gap-3 rounded-md px-5 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)] [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-display text-[16px] font-bold text-text">{title}</span>
          {hint && <span className="text-[13px] font-medium text-text-dim">{hint}</span>}
        </span>
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-full text-gray transition-transform duration-[var(--dur-fast)] ease-[var(--ease)] group-open:rotate-180"
        >
          <Icon name="chevronDown" />
        </span>
      </summary>
      <div className="border-t border-line px-5 py-5">{children}</div>
    </details>
  );
}
