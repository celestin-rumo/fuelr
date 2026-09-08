"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { IconButton } from "./button";
import { cn } from "./cn";
import { Icon } from "./icons";

/**
 * A modal that can always be reached to the bottom.
 *
 * The version this replaces centred a card in the viewport and let it grow: on
 * a 360×480 screen the meal sheet was 699px tall, which put "Retirer du
 * planning" 218px below the fold with nothing to scroll. A phone in landscape,
 * or any phone with the keyboard open, could not reach the action it had been
 * opened for.
 *
 * So the overlay scrolls, the card is capped at the visible height, and the
 * body scrolls inside it with the title and the close button staying put.
 * `dvh` rather than `vh` because the two differ by exactly the browser chrome
 * that hides and reappears on a phone.
 */
export function Dialog({
  title,
  children,
  onClose,
  closeLabel,
  className,
  placement = "center",
  ...props
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  closeLabel: string;
  className?: string;
  /**
   * `side` is the drawer: a panel along the right edge on a desk, a sheet
   * from the bottom on a phone. For options that were hiding the content —
   * a library's filters, a week's proposals — opened over the page rather
   * than laid out above it, so the list is what a screen shows first.
   */
  placement?: "center" | "side";
} & Omit<React.HTMLAttributes<HTMLDivElement>, "title" | "children">) {
  const side = placement === "side";
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      // Scrolls itself, so even a card taller than the cap stays reachable.
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-[rgba(0,0,0,0.6)]"
      {...props}
    >
      {/* Top-aligned on a short screen, centred when there is room: centring a
          tall card is what pushes its head and feet off both ends at once. */}
      <div
        className={cn(
          "flex min-h-full",
          side
            ? "items-end justify-center sm:items-stretch sm:justify-end"
            : "items-start justify-center p-4 sm:items-center sm:p-6",
        )}
      >
        <div
          className={cn(
            "flex w-full flex-col border border-line bg-bg-raised shadow-e3",
            side
              ? "max-h-[85dvh] rounded-t-lg sm:h-dvh sm:max-h-none sm:max-w-md sm:rounded-none sm:rounded-l-lg"
              : "max-h-[calc(100dvh-2rem)] max-w-lg rounded-lg",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 p-6 pb-3">
            <h2 className="font-display text-lg font-extrabold tracking-[-0.02em] text-text">
              {title}
            </h2>
            {/* Focus lands here on open, so the dialog is where the keyboard
                is and Escape is one key from the first tab stop. */}
            <IconButton autoFocus aria-label={closeLabel} variant="text" onClick={onClose}>
              <Icon name="close" />
            </IconButton>
          </div>

          {/* min-h-0 or the flex child refuses to shrink and scrolls nothing. */}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
