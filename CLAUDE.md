# Fuelr

Save your recipes and plan your meals for the week.

## Design System

Applies to `frontend/` — respect these tokens and reuse `app/components/ui/`
instead of inventing new colors or writing one-off markup when building UI.

### Color tokens

Defined as CSS custom properties in `frontend/app/globals.css`. That file is
the single source of truth for the palette — no component should ever contain
a raw hex value.

| Token                  | Light     | Dark      | Use                                     |
| ---------------------- | --------- | --------- | --------------------------------------- |
| `--background`         | `#ffffff` | `#0c0a09` | Page and surface background             |
| `--foreground`         | `#1c1917` | `#f5f5f4` | Body text                               |
| `--primary`            | `#c2410c` | `#fb923c` | Primary actions, emphasis               |
| `--primary-foreground` | `#ffffff` | `#1c1917` | Text/icons on `--primary`               |
| `--muted`              | `#f5f5f4` | `#1c1917` | Secondary surfaces, hover states        |
| `--muted-foreground`   | `#57534e` | `#a8a29e` | Secondary text, captions                |
| `--accent`             | `#0f766e` | `#2dd4bf` | Accents, highlights                     |
| `--accent-foreground`  | `#ffffff` | `#0c0a09` | Text/icons on `--accent`                |
| `--border`             | `#e7e5e4` | `#292524` | Borders, dividers                       |

These are wired into the Tailwind theme through the `@theme inline` block in
the same file, so they are consumed as utility classes — `bg-background`,
`text-muted-foreground`, `border-border`, `bg-primary/90` — not as inline
styles. Add a new color by declaring it in **both** `:root` and `.dark`, then
mapping it in `@theme inline`.

Typography and spacing use Tailwind's own defaults; there is no custom scale
to follow. Fonts are Geist Sans / Geist Mono, loaded in
`app/[locale]/layout.tsx` and exposed as `font-sans` / `font-mono`.

### Dark / light mode

Handled by `next-themes` (`defaultTheme="system"`, `enableSystem`), mounted in
`app/components/theme-provider.tsx` and wrapped around the app in
`app/[locale]/layout.tsx`. It sets a `.dark` class on `<html>`, which
`globals.css` binds Tailwind's `dark:` variant to via
`@custom-variant dark (&:where(.dark, .dark *))`.

Because every token already has a dark value, components generally need **no**
`dark:` classes at all — using `bg-background`/`text-foreground` is enough.
Reach for a `dark:` utility only for something the tokens genuinely don't
cover.

The user-facing toggle lives in `app/components/theme-toggle.tsx`.

### Component library

`frontend/app/components/ui/` (aliased as `@ui/*`; `@app/*` maps to `app/`).

- `button.tsx` — `variant`: `primary` | `secondary` | `ghost`; `size`: `sm` |
  `md` | `lg`.
- `card.tsx` — `Card`, `CardTitle`, `CardBody`.
- `cn.ts` — class-name join helper.

New UI extends or reuses these rather than writing one-off markup. Each
component takes a `className` that is merged last (via `cn`) so callers can
adjust layout without forking the component. Every component here ships a
colocated `*.test.tsx`; keep that up as new ones are added.

## Internationalization

`next-intl`, locales `fr` (default), `en`, `de`. Messages live in
`frontend/app/messages/<locale>/common.json` — one flat namespace for now;
split it once the app grows.

Every new route needs an entry in `frontend/i18n/routing.ts` under `pathnames`
with a translated slug per locale. Always import `Link`, `redirect`,
`usePathname` and `useRouter` from `@/i18n/navigation`, never from `next/link`
or `next/navigation`, or locale prefixes get lost.

## Backend

Spring Boot (`ch.celestin.fuelr`) + PostgreSQL, with Flyway migrations in
`backend/src/main/resources/db/migration/`. Schema changes go in a new
`V<n>__<name>.sql` file — never edit an applied migration.

`account/SecurityConfig.java` currently permits **all** requests; it exists
only to supply the password encoder for the admin bootstrap. Real
authentication still needs to be built before anything ships.

## Running things

Everything runs in Docker — there is no host-Node or host-Maven workflow:

```bash
docker compose -f docker-compose.dev.yml up --build
```

Frontend checks run inside the frontend container
(`docker compose -f docker-compose.dev.yml exec frontend npm run <script>`):
`lint`, `typecheck`, `test`, `test:coverage`. `typecheck` runs `next typegen`
first, because `LayoutProps`/`PageProps` are generated route types — plain
`tsc --noEmit` fails on a clean checkout without it.

Playwright browsers are not in the dev image, so `test:e2e` runs through the
official Playwright image instead — see the README for the command. The e2e
suite pins the browser locale to `fr-FR`, since the next-intl proxy negotiates
the redirect from `/` off `Accept-Language`.
