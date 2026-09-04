import type { ReactNode } from "react";
import { IconButton } from "./button";
import { Icon } from "./icons";
import { cn } from "./cn";

/**
 * Fewer, more — how many people this is for.
 *
 * Four copies of this existed: cooking mode, the recipe editor, the planner's
 * meal sheet and the planner's household size. They differed in the button
 * variant, in the size of the figure, in whether the bounds were enforced on
 * the click or only on the label — and in one of them "−" was an en dash and
 * in another a minus sign, which is the kind of difference that survives for
 * years because nobody can see it.
 *
 * The bounds are enforced here, once. A caller that clamps on its own is a
 * caller that can forget to.
 */
export type StepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Named, because two icon buttons on their own say nothing. */
  decreaseLabel: string;
  increaseLabel: string;
  /** What is shown between them — "4 personnes", or just the figure. */
  children?: ReactNode;
  /** `xl` is 56px: for a screen operated with the back of a hand. */
  size?: "md" | "xl";
  className?: string;
  "data-testid"?: string;
};

export function Stepper({
  value,
  onChange,
  min = 1,
  max = 24,
  decreaseLabel,
  increaseLabel,
  children,
  size = "md",
  className,
  "data-testid": testId,
}: StepperProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <IconButton
        aria-label={decreaseLabel}
        variant="tertiary"
        size={size}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Icon name="minus" size={size === "xl" ? 22 : 18} />
      </IconButton>

      <span
        data-testid={testId}
        className={cn(
          "tnum text-center font-semibold text-text",
          size === "xl" ? "min-w-28 text-[17px]" : "min-w-24 text-[15px]",
        )}
      >
        {children ?? value}
      </span>

      <IconButton
        aria-label={increaseLabel}
        variant="tertiary"
        size={size}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Icon name="plus" size={size === "xl" ? 22 : 18} />
      </IconButton>
    </div>
  );
}
