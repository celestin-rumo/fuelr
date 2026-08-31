import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export function TabList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn("flex items-center gap-6 border-b border-line", className)}
    >
      {children}
    </div>
  );
}

export type TabProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  children: ReactNode;
  active?: boolean;
};

export function Tab({
  children,
  active = false,
  className,
  type = "button",
  disabled,
  ...props
}: TabProps) {
  return (
    <button
      type={type}
      role="tab"
      aria-selected={active}
      disabled={disabled}
      className={cn(
        "-mb-px border-b-2 pb-3 text-sm transition-colors duration-[var(--dur-fast)] ease-[var(--ease)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]",
        "disabled:pointer-events-none disabled:border-transparent disabled:text-gray",
        active
          ? "border-accent font-bold text-text"
          : "border-transparent font-semibold text-text-dim hover:border-line hover:text-text",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
