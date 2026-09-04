import type { ElementType, ReactNode } from "react";
import { cn } from "./cn";

/**
 * A block's title, and the action that belongs to it.
 *
 * The action used to live somewhere else — the journal's link to the whole
 * history sat below the entries it belonged to, the planner's week controls
 * sat above the heading they applied to. Guidance, in Bastien and Scapin's
 * sense: what a block can do belongs beside the block, so nothing has to be
 * looked for.
 *
 * Title left, action right, everywhere. On a narrow screen it wraps rather
 * than shrinking the title, because a truncated heading is worse than a
 * second line.
 */
export type SectionHeadProps = {
  /** The heading level this block sits at. `h2` unless the page says otherwise. */
  as?: ElementType;
  children: ReactNode;
  /** A link, a button, a count. Anything the block itself can do. */
  action?: ReactNode;
  /** One line under the title, for what the title cannot say on its own. */
  hint?: ReactNode;
  className?: string;
};

export function SectionHead({
  as: Heading = "h2",
  children,
  action,
  hint,
  className,
}: SectionHeadProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Heading className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
          {children}
        </Heading>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {hint && (
        <p className="text-[13px] font-medium text-text-dim">{hint}</p>
      )}
    </div>
  );
}
