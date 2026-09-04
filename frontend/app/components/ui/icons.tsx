import { cn } from "./cn";

/**
 * The application's icons, in one place.
 *
 * The plural in the filename is not a style choice: `icon.tsx` anywhere under
 * `app/` is a Next.js metadata convention, and the router turns it into a
 * route expecting a default export. The build fails with "Export default
 * doesn't exist in target module" pointing at a file nobody wrote.
 *
 * They were typographic characters before this — `⧉` for duplicate, `✕` for
 * delete, `↑` for reorder. A glyph borrowed from a font is not an icon: it
 * renders at the weight and width of whatever face happens to resolve, it does
 * not say what it does (nobody reads `⧉` as "duplicate"), and there was no
 * glyph at all for "edit", which is why that action had no button.
 *
 * Drawn on one 24-unit grid with one stroke weight so a row of them looks like
 * a row. They are decorative by construction: the control around an icon is
 * what carries the name, which is why every one of them is `aria-hidden` and
 * every icon-only button still needs its `aria-label`.
 */
const paths = {
  /** Reorder a pinned recipe. */
  arrowUp: <path d="M12 19V5M5 12l7-7 7 7" />,
  arrowDown: <path d="M12 5v14M19 12l-7 7-7-7" />,
  /** Edit — the pencil, which is the one everybody reads without a legend. */
  pencil: <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />,
  /** Duplicate — two sheets, one behind the other. */
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </>
  ),
  /** Delete — a bin, and only ever on something that is destroyed. */
  trash: <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />,
  /** Remove from a list — the thing goes on existing. */
  close: <path d="M18 6 6 18M6 6l12 12" />,
  star: (
    <path d="m12 3.5 2.6 5.6 6 .8-4.4 4.2 1.1 6.1-5.3-3-5.3 3 1.1-6.1L3.4 9.9l6-.8Z" />
  ),
  check: <path d="m4 12.5 5 5 11-11" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  chevronRight: <path d="m9 5 7 7-7 7" />,
  chevronDown: <path d="m5 9 7 7 7-7" />,
  arrowLeft: <path d="M19 12H5M12 19l-7-7 7-7" />,
  arrowRight: <path d="M5 12h14M12 5l7 7-7 7" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  /** "What else can be done here" — the trigger of `Menu`. */
  more: (
    <>
      <circle cx="5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="19" cy="12" r="1.4" />
    </>
  ),
  /** Start cooking. A flame, which is what the action is. */
  flame: (
    <path d="M12 3s5 4.2 5 9a5 5 0 0 1-10 0c0-1.7.7-3.1 1.5-4.2.4 1 1.1 1.7 2 2C10.4 7.6 10.8 5.2 12 3Z" />
  ),
  /** Add to the week. A calendar with a plus. */
  calendarPlus: (
    <>
      <path d="M21 11V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6" />
      <path d="M8 3v4M16 3v4M3 11h18M18 15v6M15 18h6" />
    </>
  ),
  /** Cooking mode's timers. Filled, because a transport control is a solid. */
  play: <path d="M8 5.5v13l11-6.5Z" />,
  pause: <path d="M9 5v14M15 5v14" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.5l3.5 2" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.3v.2" />
    </>
  ),
  /** The four places the application goes — the phone tab bar reads these. */
  book: <path d="M4 19V5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2ZM8 7h7M8 11h7" />,
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 11h18" />
    </>
  ),
  cart: (
    <>
      <path d="M6 6h15l-2 9H8L6 6ZM6 6 5 3H2" />
      <circle cx="9" cy="20" r="1.2" />
      <circle cx="18" cy="20" r="1.2" />
    </>
  ),
  journal: (
    <>
      <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-3.5L5 21V4a1 1 0 0 1 1-1Z" />
      <path d="M9 8h6" />
    </>
  ),
  /** The household — people, because that is what it cooks for. */
  people: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20a6 6 0 0 1 12 0M16.5 5.3a3.2 3.2 0 0 1 0 5.4M18 20a6 6 0 0 0-2.6-4.9" />
    </>
  ),
} as const;

export type IconName = keyof typeof paths;

export type IconProps = {
  name: IconName;
  /** In pixels; 18 is the size a 44px control wants. */
  size?: number;
  /** Fills the shape as well as stroking it — the pinned star. */
  filled?: boolean;
  className?: string;
};

export function Icon({ name, size = 18, filled = false, className }: IconProps) {
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
    >
      {paths[name]}
    </svg>
  );
}
