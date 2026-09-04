import type { ReactNode } from "react";
import { cn } from "./cn";
import { Icon } from "./icons";

/**
 * Three tones, not four. The system gives one meaning per colour — lime is
 * action, mint is progress, coral is alert — so an amber "warning" would have
 * to borrow a colour that already means something else. A warning is either
 * worth an alert or it is information.
 */
export type BannerTone = "error" | "success" | "info";

export type BannerProps = {
  tone?: BannerTone;
  /** Bold first line. Skip it when one sentence says everything. */
  title?: string;
  children?: ReactNode;
  /** Rendered after the text: a retry button, a link onward. */
  action?: ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
  /**
   * `fixed` pins it to the bottom of the viewport, above everything, for
   * something wrong with the page as a whole. `inline` is the default and
   * flows where it is written, for something wrong with the form it sits in.
   */
  position?: "inline" | "fixed";
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "title" | "children">;

const tones: Record<BannerTone, string> = {
  error: "border-coral-ink bg-[color-mix(in_srgb,var(--coral)_12%,var(--bg-raised))]",
  success: "border-mint-ink bg-[color-mix(in_srgb,var(--mint)_12%,var(--bg-raised))]",
  info: "border-line bg-bg-raised",
};

const marks: Record<BannerTone, string> = {
  error: "!",
  success: "✓",
  info: "i",
};

const markTones: Record<BannerTone, string> = {
  error: "bg-coral text-on-accent",
  success: "bg-mint text-on-accent",
  info: "bg-bg-raised-2 text-text-dim",
};

export function Banner({
  tone = "info",
  title,
  children,
  action,
  onDismiss,
  dismissLabel = "Fermer",
  position = "inline",
  className,
  ...props
}: BannerProps) {
  return (
    <div
      // An error interrupts; anything else waits its turn. Tests should reach
      // for a data-testid rather than the role: Next keeps its own route
      // announcer with role="alert" in the DOM, so a page-wide query by role
      // always matches two nodes.
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-md border p-4",
        tones[tone],
        position === "fixed" &&
          "fixed inset-x-4 bottom-4 z-50 mx-auto max-w-[560px] shadow-e2",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[12px] font-bold",
          markTones[tone],
        )}
      >
        {marks[tone]}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title && (
          <p className="text-[14px] font-bold text-text">{title}</p>
        )}
        {children && (
          <div className="text-[13px] leading-[1.5] font-medium text-text-dim">
            {children}
          </div>
        )}
        {action && <div className="mt-2 flex flex-wrap gap-2">{action}</div>}
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel}
          // 44px of target on a phone, 28 where there is a pointer.
          className="-mt-2 -mr-2 grid size-11 shrink-0 place-items-center rounded-full sm:-mt-1 sm:-mr-1 sm:size-7 text-gray transition-colors duration-[var(--dur-fast)] ease-[var(--ease)] hover:bg-bg-raised-2 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]"
        >
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  );
}
