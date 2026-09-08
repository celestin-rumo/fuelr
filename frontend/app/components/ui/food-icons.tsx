import { cn } from "./cn";

/**
 * Foods, drawn on the same 24-unit grid and stroke as `icons.tsx`.
 *
 * They exist for one screen: the wait while a model writes dishes. A wait
 * of two minutes needs something that moves, and a spinner says only "still
 * here". These say *what* is being cooked with — the chicken and the carrot
 * somebody typed, or the courge of the soup that was just started — which
 * is the difference between a wait and a hang. Decorative by construction,
 * like every icon here: `aria-hidden`, and the panel around them carries
 * the words.
 *
 * Kept apart from the application's icons so the pencil and the bin never
 * share a list with a drumstick.
 */
const paths = {
  drumstick: (
    <>
      <path d="M11 5.5a5.5 5.5 0 1 1 7.5 7.5L14 17.5 6.5 10 11 5.5Z" />
      <path d="m6.5 10-2 2M14 17.5l-2 2" />
      <circle cx="3.5" cy="13" r="1.4" />
      <circle cx="11" cy="20.5" r="1.4" />
    </>
  ),
  steak: (
    <>
      <path d="M4 8c3-3 10-4 14-1s3 8-1 11-11 3-13-1S1 11 4 8Z" />
      <path d="M12 8c-1 2 0 4 1 5" />
    </>
  ),
  fish: (
    <>
      <path d="M2.5 12S6 6 12 6c3.5 0 6 2.5 8 4l1.5-3v10L20 14c-2 1.5-4.5 4-8 4-6 0-9.5-6-9.5-6Z" />
      <circle cx="8" cy="11" r="1" />
    </>
  ),
  egg: <path d="M12 3c3.5 0 6.5 5 6.5 10a6.5 6.5 0 0 1-13 0C5.5 8 8.5 3 12 3Z" />,
  tomato: (
    <>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 6c0-1.5 1-3 2.5-3.5M12 6C10.5 4.5 8.5 4 7 4.5M12 6c1.5-1 3.5-1 5-.5" />
    </>
  ),
  onion: (
    <>
      <path d="M12 4c-2 3-6.5 5-6.5 10a6.5 6.5 0 0 0 13 0C18.5 9 14 7 12 4Z" />
      <path d="M12 4v16.5M9 10c-1 3-1 6 0 9M15 10c1 3 1 6 0 9" />
    </>
  ),
  carrot: (
    <>
      <path d="M20.5 3.5c1 5-4 13.5-11.5 13.5L5.5 13.5C5.5 6 15.5 2.5 20.5 3.5Z" />
      <path d="m9 17-5.5 3.5M20.5 3.5 18 1.5M20.5 3.5 22.5 1M20.5 3.5l-3-.5" />
    </>
  ),
  potato: (
    <>
      <path d="M7 5c4-2 9-1.5 11.5 2s1 8-2 11-8.5 2.5-11-1S3 7 7 5Z" />
      <circle cx="9" cy="10" r=".8" />
      <circle cx="14" cy="13" r=".8" />
      <circle cx="11" cy="15.5" r=".8" />
    </>
  ),
  pepper: (
    <>
      <path d="M12 7c-4-2-8 1-8 6s3 8 8 8 8-3 8-8-4-8-8-6Z" />
      <path d="M12 7c0-2 1-3 3-3.5M9 8.5v11M15 8.5v11" />
    </>
  ),
  mushroom: (
    <>
      <path d="M3 11a9 6 0 0 1 18 0Z" />
      <path d="M9 11v7a3 3 0 0 0 6 0v-7" />
    </>
  ),
  lemon: (
    <>
      <path d="M5 6c3-3 9-3 12.5.5S21 15 18 18s-9 3-12.5-.5S2 9 5 6Z" />
      <path d="m4 4 1.5 1.5M20 20l-1.5-1.5" />
    </>
  ),
  apple: (
    <>
      <path d="M12 7c-2-1.5-5-1-6.5 1.5S4 15 6 18s4 3 6 2c2 1 4 1 6-2s2.5-7 .5-9.5S14 5.5 12 7Z" />
      <path d="M12 7c0-2 1-3.5 3-4" />
    </>
  ),
  leaf: (
    <>
      <path d="M4 20c0-9 5-14 16-16-1 11-6 16-16 16Z" />
      <path d="M4 20 14 10" />
    </>
  ),
  bowl: (
    <>
      <path d="M3 11h18a9 9 0 0 1-18 0Z" />
      <path d="M8 21h8M12 20v1" />
      <path d="M8 7c0-1.5 1-1.5 1-3M12 7c0-1.5 1-1.5 1-3M16 7c0-1.5 1-1.5 1-3" />
    </>
  ),
  bread: (
    <>
      <path d="M4 10a3 3 0 0 1 0-6h16a3 3 0 0 1 0 6v9H4Z" />
      <path d="M9 10v9M12 4c-2 2-2 4 0 6" />
    </>
  ),
  cheese: (
    <>
      <path d="M3 10 21 5v10H3Z" />
      <path d="M3 10c6 0 12-1.5 18-5M3 10v5" />
      <circle cx="9" cy="12.5" r="1" />
      <circle cx="15" cy="10.5" r="1.2" />
    </>
  ),
  pot: (
    <>
      <path d="M4 9h16v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z" />
      <path d="M2 9h20M8 9V6h8v3M4 13H2M22 13h-2" />
    </>
  ),
} as const;

export type FoodName = keyof typeof paths;

export const FOOD_NAMES = Object.keys(paths) as FoodName[];

export function FoodIcon({
  name,
  size = 24,
  className,
}: {
  name: FoodName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      data-food={name}
      className={cn("shrink-0", className)}
    >
      {paths[name]}
    </svg>
  );
}
