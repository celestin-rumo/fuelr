import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type SwitchProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "children"
> & {
  label: ReactNode;
};

export function Switch({ label, className, disabled, ...props }: SwitchProps) {
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
        role="switch"
        className="peer sr-only"
        disabled={disabled}
        {...props}
      />
      <span
        aria-hidden
        className={cn(
          "relative h-6.5 w-11 shrink-0 rounded-full border-[1.5px] border-line bg-bg-raised-2",
          "transition-colors duration-[var(--dur-control)] ease-[var(--ease)]",
          "peer-hover:border-gray",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--mint-ink)]",
          "peer-checked:border-transparent peer-checked:bg-accent",
          "peer-disabled:border-line peer-disabled:bg-bg-raised-2",
          "peer-checked:peer-disabled:bg-line",
          // Knob: sits left when off, slides right when on.
          "[&>span]:absolute [&>span]:top-1/2 [&>span]:left-[3px] [&>span]:size-4.5 [&>span]:-translate-y-1/2 [&>span]:rounded-full [&>span]:bg-gray",
          "[&>span]:transition-[left,background-color] [&>span]:duration-[var(--dur-control)] [&>span]:ease-[var(--ease)]",
          "peer-hover:[&>span]:bg-text-dim",
          "peer-checked:[&>span]:left-[21px] peer-checked:[&>span]:bg-on-accent peer-checked:[&>span]:shadow-[0_1px_3px_rgba(0,0,0,0.3)]",
          "peer-disabled:[&>span]:bg-line peer-disabled:[&>span]:shadow-none",
          "peer-checked:peer-disabled:[&>span]:bg-gray",
        )}
      >
        <span />
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
