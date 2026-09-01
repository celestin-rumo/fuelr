# Fuelr

Save your recipes and plan your meals for the week.

## Design System

Applies to `frontend/` — respect these tokens and reuse `app/components/ui/`
instead of inventing new colours or writing one-off markup when building UI.
The living reference is the `/design-system` page
(`app/[locale]/design-system/page.tsx`); it renders from the real tokens, so
if a change looks wrong there, it is wrong.

**Three principles.** Dark by default — the near-black ground is what lets the
lime carry the action, and light is a mirror, not a second system. Food first —
the UI stays neutral so dish photos are the only uncontrolled colour. One
accent per view — lime = action, mint = progress, coral = alert; never two
roles for one colour.

### Colour

Defined in `frontend/app/globals.css`. A component never hardcodes a hex: it
uses a token. That is what lets the light theme exist without duplicating a
single component.

| Token             | Dark        | Light       | Use                              |
| ----------------- | ----------- | ----------- | -------------------------------- |
| `--bg`            | `#121212`   | `#F7F5EF`   | Page ground                      |
| `--bg-raised`     | `#191919`   | `#FFFFFF`   | Cards, panels, nav bar           |
| `--bg-raised-2`   | `#212121`   | `#ECE9DF`   | Fields, inactive chips, tracks   |
| `--text`          | `#F5F5F0`   | `#15150F`   | Primary text                     |
| `--text-dim`      | `#B9B9B4`   | `#5B5A50`   | Descriptions, metadata           |
| `--gray`          | `#6B7280`   | `#64635A`   | Labels, inactive icons, borders  |
| `--line`          | `f5f5f0/8%` | `15150f/12%`| Separators, card outlines        |
| `--lime`          | `#C4F135`   | `#C4F135`   | Primary action (flat)            |
| `--lime-ink`      | `#C4F135`   | `#4B5E12`   | Lime as text or border           |
| `--mint`          | `#2DD4BF`   | `#2DD4BF`   | Progress, focus (flat)           |
| `--mint-ink`      | `#2DD4BF`   | `#0E6B5F`   | Mint as text or link             |
| `--coral`         | `#FF6B4A`   | `#FF6B4A`   | Alert, badge (flat)              |
| `--coral-ink`     | `#FF6B4A`   | `#9C321B`   | Coral as text or border          |
| `--on-accent`     | `#121212`   | `#121212`   | Text on a flat accent fill       |

`--accent` / `--accent-ink` alias the current action colour (lime). Behind
these sit the full 100→1000 ramps (`--lime-500`, `--mint-800`, …): step 500 is
the flat brand colour in both themes, and the `*-ink` steps are what carry
text on light grounds. Use a ramp step directly only when a semantic token
genuinely doesn't cover the case.

All of it is wired into the Tailwind theme via `@theme inline`, so it is
consumed as `bg-bg-raised`, `text-text-dim`, `border-line`, `text-accent-ink`,
`bg-accent/14`, never as inline styles. Adding a colour means declaring it in
`:root` **and** `.light`, then mapping it in `@theme inline`.

### Type, space, shape, motion

- **Type** — Poppins ExtraBold (`font-display`) for brand voice and headings,
  Manrope (`font-sans`) for everything else, JetBrains Mono (`font-mono`) for
  quantities and units. Add `.tnum` to any changing figure so it doesn't jump.
  Scale: Display 44/40·800, H1 32/28·800, H2 22/20·800, H3 16·700, Body
  15·500·1.5, Meta 13·600, Label 11·700·.02em, Data 13·mono. Body lines cap at
  68ch, heading leading 1.1–1.2, nothing below 11px, Poppins only from 14px,
  uppercase for labels only.
- **Space** — 4px base, and nothing off the scale. Tailwind's default spacing
  is already this scale, so `p-4` = 16px, `gap-6` = 24px. If a spacing "doesn't
  land", revisit the composition, not the scale.
- **Shape** — `rounded-sm` 8px (fields, tags), `rounded-md` 14px (cards),
  `rounded-lg` 20px (panels), `rounded-full` (buttons, chips). A card never
  mixes two surface radii.
- **Elevation** — e0 is border-only (in-flow cards), then `shadow-e1` (card
  hover), `shadow-e2` (menus, toasts), `shadow-e3` (modals, sheets). In dark
  elevation reads through the surface, in light through the shadow.
- **Motion** — `var(--dur-fast)` 120ms, `var(--dur)` 180ms,
  `var(--dur-control)` 160ms, `var(--dur-sheet)` 240ms, all on `var(--ease)`
  = `cubic-bezier(.2,.8,.2,1)`. Nothing lasts longer than 240ms: a cooking app
  gets read with dirty hands. Reduced motion is honoured globally in
  `globals.css`.
- **Focus** — always the mint ring: `focus-visible:outline-2
  focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]`.

### Dark / light

`next-themes` with `attribute="class"`, `defaultTheme="dark"` and
`enableSystem={false}` (dark is a brand decision, not a preference). It puts
`dark` or `light` on `<html>`; `:root` holds the dark values and `.light`
overrides them.

Because every token already carries both themes, components need **no** `dark:`
classes — `bg-bg-raised` / `text-text` is enough. The toggle lives in
`app/components/theme-toggle.tsx`.

### Component library

`frontend/app/components/ui/` (aliased `@ui/*`; `@app/*` maps to `app/`).

| File              | Exports                                                        |
| ----------------- | -------------------------------------------------------------- |
| `button.tsx`      | `Button` (6 variants × 3 sizes, `loading`, `fullWidth`), `IconButton` |
| `input.tsx`       | `Input` (label + hint, `status` default/error/success)          |
| `checkbox.tsx`    | `Checkbox` (`indeterminate`, `error`)                           |
| `radio.tsx`       | `Radio`                                                         |
| `switch.tsx`      | `Switch`                                                        |
| `chip.tsx`        | `Chip` (`active`, `count`, `onRemove`)                          |
| `tabs.tsx`        | `TabList`, `Tab`                                                |
| `card.tsx`        | `Card` (`as="card"\|"panel"`, `interactive`, `selected`), `CardTitle`, `CardBody` |
| `recipe-card.tsx` | `RecipeCard` (favourite, selected, unavailable)                 |
| `badge.tsx`       | `Badge` (accent / mint / coral / neutral / solid)               |
| `empty-state.tsx` | `EmptyState` (neutral / error tone)                             |
| `spinner.tsx`     | `Spinner`                                                       |
| `cn.ts`           | class-name join helper                                          |

Button variants are `primary` (one per view), `secondary`, `tertiary`, `text`,
`danger`, `soft`. New UI extends or reuses these rather than writing one-off
markup. Every component takes a `className` merged last through `cn`, so
callers adjust layout without forking the component. Each ships a colocated
`*.test.tsx`; keep that up as new ones are added, and add the component to the
`/design-system` page so the reference stays complete.

**Watch out for competing Tailwind utilities.** When two variants set the same
property (`bg-transparent` vs `peer-checked:bg-accent` vs
`peer-disabled:bg-bg-raised-2`), the winner is decided by Tailwind's stylesheet
order and specificity, not by the order you list the classes. Where a state is
known in JS, branch in JS and emit only one of them — see `checkbox.tsx`. Where
it isn't, chain the variants (`peer-checked:peer-disabled:…`) so each
combination sets the property exactly once, and verify the computed style
rather than trusting the class list.

## Internationalization

`next-intl`, locales `fr` (default), `en`, `de`. Messages live in
`frontend/app/messages/<locale>/common.json` — one flat namespace for now;
split it once the app grows.

Every new route needs an entry in `frontend/i18n/routing.ts` under `pathnames`
with a translated slug per locale. Always import `Link`, `redirect`,
`usePathname` and `useRouter` from `@/i18n/navigation`, never from `next/link`
or `next/navigation`, or locale prefixes get lost.

The `/design-system` page is an internal reference and is deliberately not
translated — its copy is English like the rest of the codebase.

**Translation is an acceptance criterion.** Whenever a story displays text —
labels, headings, buttons, hints, errors, empty states, emails, page titles and
metadata — the story is not done until every string goes through the message
catalogues and all three locales (`fr`, `en`, `de`) are filled in, along with
the `pathnames` slugs for any new route. Write it into the story's acceptance
criteria explicitly; a hardcoded string is a failed criterion, not a follow-up.

## Backend

Spring Boot (`ch.celestin.fuelr`) + PostgreSQL, with Flyway migrations in
`backend/src/main/resources/db/migration/`. Schema changes go in a new
`V<n>__<name>.sql` file — never edit an applied migration.

`account/SecurityConfig.java` denies anything not explicitly listed as public.
Two rules that are easy to get wrong there:

- **Errors on public endpoints need `DispatcherType.ERROR` permitted.** Spring
  re-dispatches to `/error`, which is a fresh, unauthenticated request; without
  that line every failure on a public endpoint comes back as 401, including a
  wrong password. MockMvc does not replay the ERROR dispatch, so a green test
  suite proves nothing — check it over real HTTP.
- **Anything answering about an account must not differ by whether it exists.**
  Not in status, not in body, and not in *timing*: `MailService.send` is
  `@Async` precisely so a reset request does not take measurably longer for a
  real address once a remote relay is doing the sending.

Backend tests must not depend on a writable `/var/lib` — `MediaStorage` creates
its directory at startup, so a missing one fails **every** Spring context, not
just the upload tests. `src/test/resources/application.properties` points
`app.media.dir` at the temp directory for that reason.

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

**A logged meal must copy its values, never reference the recipe.** Recipes get
edited after they have been used, so a meal log pointing at the live recipe
would silently rewrite someone's nutritional history every time they fix a typo
in the ingredients. Whoever builds the meal log copies title, quantities and
computed nutrition into the log row at the moment of logging. The recipe editor
already warns the author that edits apply to future uses only — that promise is
currently made by the copy and enforced by nothing, because there is no meal
log yet.

**Responsive is an acceptance criterion, not a polish pass.** Every screen has
to hold up from a narrow phone to a wide desktop before a story is done — no
horizontal body scroll, no control pushed off-screen, no label truncated into
meaninglessness. Where space runs out, decide what to drop: the recipe editor's
stepper keeps only the current step's label below `sm`, so three labels cannot
squeeze the connectors to nothing, and the header's sign-out button drops to its
icon there. Check a narrow viewport in the browser, not only a wide one.

When a control loses its visible label that way, give it an explicit
`aria-label`. Hiding the text with `sr-only` alone has bitten this codebase
twice: the button keeps its name, but a button whose label is `hidden` has none
at all.

**`getByRole("alert")` matches two nodes in e2e.** Next.js keeps its own
`__next-route-announcer__` in the DOM with `role="alert"`, so a page-wide query
is always a strict-mode violation. Scope the query to the form or give the
message a `data-testid`. It does not reproduce in unit tests, because jsdom has
no route announcer — so a green Vitest run proves nothing here.

Playwright browsers are not in the dev image, so `test:e2e` runs through the
official Playwright image instead — see the README for the command. The e2e
suite pins the browser locale to `fr-FR`, since the next-intl proxy negotiates
the redirect from `/` off `Accept-Language`.
