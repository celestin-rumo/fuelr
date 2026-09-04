"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "./cn";
import { Icon, type IconName } from "./icons";

/**
 * A button that shows what else can be done.
 *
 * It exists to keep a row of controls short. Five recipe actions in a rail is
 * 264px of buttons on a 360px screen, and adding "cook" and "plan" — the two
 * things somebody actually opens the library to do — would have pushed it to
 * two lines. So the frequent actions stay visible and the rest live here.
 *
 * The rule the rail already followed still holds: the trigger sits in the same
 * place on every row, and an item that does not apply is disabled inside the
 * menu rather than missing from it.
 *
 * Not a `<select>`, not a `<dialog>`: a plain button with `aria-expanded` and
 * a list of buttons. Escape closes it and returns focus to the trigger, a
 * click anywhere else closes it, and choosing an item closes it — because a
 * menu that stays open after a choice is a menu somebody has to dismiss.
 */
export type MenuItem = {
  label: string;
  /** For an item that acts. Mutually exclusive with `href`. */
  onSelect?: () => void;
  /**
   * For an item that goes somewhere — a page, or a file to download.
   *
   * It renders an anchor rather than a button, so it can be opened in a new
   * tab and copied like any other link, and so a download is the browser's
   * navigation rather than a script assigning `location`.
   */
  href?: string;
  download?: boolean;
  icon?: IconName;
  disabled?: boolean;
  /** Draws the item in the alert colour. For something that destroys. */
  destructive?: boolean;
  testId?: string;
};

export type MenuProps = {
  /** Names the trigger. Required when the trigger is an icon alone. */
  label: string;
  items: MenuItem[];
  /** What the trigger looks like. Defaults to a `⋯` icon button. */
  trigger?: ReactNode;
  triggerClassName?: string;
  /** Which edge the panel is aligned to. `end` for a rail at a row's end. */
  align?: "start" | "end";
  className?: string;
  "data-testid"?: string;
};

export function Menu({
  label,
  items,
  trigger,
  triggerClassName,
  align = "end",
  className,
  "data-testid": testId,
}: MenuProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      // Back to the trigger: closing a menu must not drop focus onto the body,
      // which sends a keyboard user to the top of the page.
      button.current?.focus();
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={root}
      // The stacking order is decided here, not by the caller. A rail's
      // controls sit at `z-10` and `position: relative` with a z-index makes
      // a stacking context, so a panel at `z-40` *inside* a `z-10` wrapper
      // still loses to the next row's controls — which show through it. The
      // open menu's own wrapper is what has to rise.
      className={cn("relative", open ? "z-30" : "z-10", className)}
      data-testid={testId}
    >
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((was) => !was)}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-full font-bold whitespace-nowrap",
          "transition-colors duration-[var(--dur-fast)] ease-[var(--ease)]",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]",
          trigger
            ? "h-9 border-[1.5px] border-gray px-4 text-[13px] text-text hover:border-text max-sm:h-11"
            : "size-11 shrink-0 text-gray hover:bg-[color-mix(in_srgb,var(--text)_8%,transparent)] hover:text-text",
          triggerClassName,
        )}
      >
        {trigger ?? <Icon name="more" size={18} />}
      </button>

      {open && (
        <div
          id={panelId}
          role="menu"
          aria-label={label}
          className={cn(
            "absolute top-[calc(100%+6px)] min-w-60 rounded-md border border-line bg-bg-raised p-1.5 shadow-e2",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {items.map((item) => {
            const classes = cn(
              "flex min-h-11 w-full items-center gap-3 rounded-sm px-3 py-2 text-left text-[14px] leading-[1.35] font-semibold",
              "transition-colors duration-[var(--dur-fast)] ease-[var(--ease)]",
              "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--mint-ink)]",
              // Branched in JS: three competing colour utilities would be
              // resolved by Tailwind's stylesheet order, not by this list.
              item.disabled
                ? "pointer-events-none text-gray opacity-45"
                : item.destructive
                  ? "text-coral-ink hover:bg-[color-mix(in_srgb,var(--coral)_12%,transparent)]"
                  : "text-text hover:bg-bg-raised-2",
            );
            const body = (
              <>
                {item.icon && <Icon name={item.icon} />}
                {item.label}
              </>
            );

            return item.href && !item.disabled ? (
              <a
                key={item.label}
                role="menuitem"
                href={item.href}
                download={item.download}
                data-testid={item.testId}
                onClick={() => setOpen(false)}
                className={classes}
              >
                {body}
              </a>
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                data-testid={item.testId}
                onClick={() => {
                  setOpen(false);
                  item.onSelect?.();
                }}
                className={classes}
              >
                {body}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
