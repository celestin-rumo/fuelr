import type { HTMLAttributes } from "react";
import { cn } from "./cn";

// Lime = action, mint = progress, coral = alert. Never two roles for a colour.
const tones = {
  accent: "bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-accent-ink",
  mint: "bg-[color-mix(in_srgb,var(--mint)_18%,transparent)] text-mint-ink",
  coral: "bg-[color-mix(in_srgb,var(--coral)_18%,transparent)] text-coral-ink",
  neutral: "bg-bg-raised-2 text-text-dim",
  solid: "bg-accent text-on-accent",
} as const;

export type BadgeTone = keyof typeof tones;

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold tracking-[0.02em] uppercase",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
