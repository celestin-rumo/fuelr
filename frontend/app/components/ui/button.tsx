import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";
import { Spinner } from "./spinner";

// Six variants, one action role each. Only one primary per view.
// Every colour is a token — see app/globals.css.
/** Shared by the button and by anchors that must look like one. */
const BASE = [
  "inline-flex items-center justify-center gap-2 rounded-full font-bold whitespace-nowrap",
  "transition-[background-color,border-color,color,filter,transform] duration-[var(--dur)] ease-[var(--ease)]",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]",
  "active:scale-[0.97]",
  // Disabled is one flat treatment across every variant.
  "disabled:pointer-events-none disabled:border-transparent disabled:bg-bg-raised-2 disabled:text-gray disabled:no-underline disabled:brightness-100",
].join(" ");

const variants = {
  primary: "bg-accent text-on-accent hover:brightness-[1.08] active:brightness-[0.94]",
  secondary:
    "border-[1.5px] border-gray text-text hover:border-text hover:bg-[color-mix(in_srgb,var(--text)_6%,transparent)] active:bg-[color-mix(in_srgb,var(--text)_10%,transparent)]",
  tertiary: "bg-bg-raised-2 text-text hover:bg-line active:brightness-[0.96]",
  text: "text-mint-ink hover:underline active:brightness-[0.9]",
  danger:
    "border-[1.5px] border-coral-ink text-coral-ink hover:border-coral hover:bg-coral hover:text-on-accent active:brightness-[0.94]",
  soft: "bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-accent-ink hover:bg-[color-mix(in_srgb,var(--accent)_22%,transparent)] active:bg-[color-mix(in_srgb,var(--accent)_26%,transparent)]",
  // Destructive with no surface, for a remove control sitting inside a row.
  // `text` with a coral class does not work: two competing text-colour
  // utilities are resolved by Tailwind's sheet order, not by class order.
  dangerText:
    "text-coral-ink hover:bg-[color-mix(in_srgb,var(--coral)_12%,transparent)] active:brightness-[0.9]",
} as const;

const sizes = {
  /**
   * 36px on a desktop, 44px on a phone.
   *
   * The floor is not decoration: at 360px a hand holding a basket or a knife
   * misses a 36px control, and the smallest one in this app used to be the
   * delete button. Two heights in one string are resolved by Tailwind's
   * stylesheet order rather than by the order they are written, so
   * `e2e/mobile-360.spec.ts` measures the rendered box at 360px instead of
   * trusting the class list — jsdom loads no stylesheet and cannot tell.
   */
  sm: "h-9 max-sm:h-11 px-4 text-[13px]",
  md: "h-[46px] px-5 text-[15px]",
  lg: "h-[54px] px-7 text-base",
  /**
   * 56px, the smallest target that can be hit with the back of a hand.
   *
   * It is a size rather than a `className` on the caller, because passing
   * `h-14` in would lose: the size class is already in the string, and which
   * height wins is decided by Tailwind's stylesheet order, not by the order
   * the classes are listed. Cooking mode was silently getting 46px.
   */
  xl: "h-14 px-7 text-base",
  /**
   * No box at all, for a control that supplies its own — `IconButton` does.
   *
   * It exists so there is never a second height in the class string: which of
   * two competing utilities wins is decided by Tailwind's stylesheet order,
   * not by the order they are listed, and that is not a thing to be guessing
   * about. Callers should reach for a real size.
   */
  none: "",
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

/**
 * The button's look, without the button.
 *
 * For a control that navigates: an anchor styled as a button is correct, and
 * a Button nested inside a Link is not — that is two interactive elements
 * where the markup promises one, and it is the same nesting already untangled
 * in `chip.tsx`.
 */
export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}) {
  return cn(BASE, fullWidth && "w-full", variants[variant], sizes[size], className);
}

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
        buttonClasses({ variant, size, fullWidth }),
        loading && "cursor-progress brightness-[0.96]",
        className,
      )}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

/** Square. The button itself emits no size, so these are uncontested. */
const iconSizes = {
  md: "h-11 w-11",
  xl: "h-14 w-14",
} as const;

export type IconButtonProps = Omit<ButtonProps, "size" | "fullWidth"> & {
  /** Required: an icon button has no text to name it. */
  "aria-label": string;
  selected?: boolean;
  /** `xl` is 56px: for a screen operated with dirty hands. */
  size?: keyof typeof iconSizes;
};

export function IconButton({
  className,
  selected = false,
  variant = "tertiary",
  size = "md",
  children,
  ...props
}: IconButtonProps) {
  return (
    <Button
      variant={selected ? "primary" : variant}
      size="none"
      className={cn(iconSizes[size], "shrink-0 p-0 text-base", className)}
      {...props}
    >
      {children}
    </Button>
  );
}
