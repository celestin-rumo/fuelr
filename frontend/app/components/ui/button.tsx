import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";
import { Spinner } from "./spinner";

// Six variants, one action role each. Only one primary per view.
// Every colour is a token — see app/globals.css.
const variants = {
  primary: "bg-accent text-on-accent hover:brightness-[1.08] active:brightness-[0.94]",
  secondary:
    "border-[1.5px] border-gray text-text hover:border-text hover:bg-[color-mix(in_srgb,var(--text)_6%,transparent)] active:bg-[color-mix(in_srgb,var(--text)_10%,transparent)]",
  tertiary: "bg-bg-raised-2 text-text hover:bg-line active:brightness-[0.96]",
  text: "text-mint-ink hover:underline active:brightness-[0.9]",
  danger:
    "border-[1.5px] border-coral-ink text-coral-ink hover:border-coral hover:bg-coral hover:text-on-accent active:brightness-[0.94]",
  soft: "bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-accent-ink hover:bg-[color-mix(in_srgb,var(--accent)_22%,transparent)] active:bg-[color-mix(in_srgb,var(--accent)_26%,transparent)]",
} as const;

const sizes = {
  sm: "h-9 px-4 text-[13px]",
  md: "h-[46px] px-5 text-[15px]",
  lg: "h-[54px] px-7 text-base",
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

export type ButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  children?: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  className,
  type = "button",
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-bold whitespace-nowrap",
        "transition-[background-color,border-color,color,filter,transform] duration-[var(--dur)] ease-[var(--ease)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]",
        "active:scale-[0.97]",
        // Disabled is one flat treatment across every variant.
        "disabled:pointer-events-none disabled:border-transparent disabled:bg-bg-raised-2 disabled:text-gray disabled:no-underline disabled:brightness-100",
        loading && "cursor-progress brightness-[0.96]",
        fullWidth && "w-full",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export type IconButtonProps = Omit<ButtonProps, "size" | "fullWidth"> & {
  /** Required: an icon button has no text to name it. */
  "aria-label": string;
  selected?: boolean;
};

export function IconButton({
  className,
  selected = false,
  variant = "tertiary",
  children,
  ...props
}: IconButtonProps) {
  return (
    <Button
      variant={selected ? "primary" : variant}
      className={cn("h-11 w-11 shrink-0 p-0 text-base", className)}
      {...props}
    >
      {children}
    </Button>
  );
}
