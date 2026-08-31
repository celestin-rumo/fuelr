import { Card } from "@ui/card";
import { cn } from "@ui/cn";

// Only the three accent roles exist: lime = action, mint = progress,
// coral = alert. A feature picks one, never a fourth colour.
const tones = {
  accent: "bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-accent-ink",
  mint: "bg-[color-mix(in_srgb,var(--mint)_18%,transparent)] text-mint-ink",
  coral: "bg-[color-mix(in_srgb,var(--coral)_18%,transparent)] text-coral-ink",
} as const;

export type FeatureTone = keyof typeof tones;

export type FeatureCardProps = {
  icon: string;
  title: string;
  text: string;
  meta: string;
  tone?: FeatureTone;
};

export function FeatureCard({
  icon,
  title,
  text,
  meta,
  tone = "accent",
}: FeatureCardProps) {
  return (
    <Card interactive className="flex flex-col">
      <span
        aria-hidden
        className={cn(
          "grid size-11 place-items-center rounded-md text-lg",
          tones[tone],
        )}
      >
        {icon}
      </span>
      <h3 className="mt-4 font-display text-base font-bold text-text">
        {title}
      </h3>
      <p className="mt-2 text-[15px] leading-[1.5] font-medium text-text-dim">
        {text}
      </p>
      <p className="mt-4 font-mono text-[11px] text-gray">{meta}</p>
    </Card>
  );
}
