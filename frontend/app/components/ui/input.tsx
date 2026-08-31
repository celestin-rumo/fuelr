"use client";

import { useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type FieldStatus = "default" | "error" | "success";

const statusBorder: Record<FieldStatus, string> = {
  default: "border-gray hover:border-text-dim",
  error: "border-coral-ink",
  success: "border-mint-ink",
};

const statusHint: Record<FieldStatus, string> = {
  default: "text-gray",
  error: "text-coral-ink",
  success: "text-mint-ink",
};

const statusIcon: Record<FieldStatus, string | null> = {
  default: null,
  error: "!",
  success: "✓",
};

export type InputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "children"
> & {
  label: string;
  hint?: ReactNode;
  status?: FieldStatus;
};

export function Input({
  label,
  hint,
  status = "default",
  className,
  id,
  disabled,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = `${inputId}-hint`;
  const icon = statusIcon[status];

  return (
    <div className="flex w-full flex-col gap-2">
      <label
        htmlFor={inputId}
        className={cn(
          "text-[13px] font-semibold",
          disabled ? "text-gray" : "text-text-dim",
        )}
      >
        {label}
      </label>

      <div className="relative">
        <input
          id={inputId}
          disabled={disabled}
          aria-invalid={status === "error" || undefined}
          aria-describedby={hint ? hintId : undefined}
          className={cn(
            "h-[46px] w-full rounded-sm border-[1.5px] bg-bg px-4 text-[15px] text-text",
            "placeholder:text-gray",
            "transition-[border-color] duration-[var(--dur-fast)] ease-[var(--ease)]",
            "focus:border-mint-ink focus:outline-2 focus:outline-offset-2 focus:outline-[var(--mint-ink)]",
            "disabled:cursor-not-allowed disabled:border-line disabled:bg-bg-raised-2 disabled:text-gray",
            icon && "pr-11",
            statusBorder[status],
            className,
          )}
          {...props}
        />
        {icon && (
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm font-bold",
              statusHint[status],
            )}
          >
            {icon}
          </span>
        )}
      </div>

      {hint && (
        <p className={cn("text-xs font-medium", statusHint[status])} id={hintId}>
          {hint}
        </p>
      )}
    </div>
  );
}
