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
| `button.tsx`      | `Button` (6 variants × 4 sizes + `none`, `loading`, `fullWidth`), `IconButton` (`size` md/xl) |
| `input.tsx`       | `Input` (label + hint, `status` default/error/success)          |
| `checkbox.tsx`    | `Checkbox` (`indeterminate`, `error`)                           |
| `radio.tsx`       | `Radio`                                                         |
| `switch.tsx`      | `Switch`                                                        |
| `chip.tsx`        | `Chip` (`active`, `count`, `onRemove`)                          |
| `tabs.tsx`        | `TabList`, `Tab`                                                |
| `card.tsx`        | `Card` (`as="card"\|"panel"`, `interactive`, `selected`), `CardTitle`, `CardBody` |
| `recipe-card.tsx` | `RecipeCard` (favourite, selected, unavailable)                 |
| `badge.tsx`       | `Badge` (accent / mint / coral / neutral / solid)               |
| `banner.tsx`      | `Banner` (error / success / info, `title`, `action`, `onDismiss`, `position="inline"\|"fixed"`) |
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

This also catches passing a display utility to a component that already sets
one. `<Button className="hidden sm:inline-flex">` never hid anything: `Button`
sets `inline-flex` itself and `.hidden` is emitted earlier in the stylesheet,
so the CTA stayed visible at 375px and pushed every marketing page 88px
sideways. Put the toggle on a wrapper, or use `buttonClasses()` on an element
of your own.

A size behaves the same way. `<Button className="h-14">` did nothing: the
size class already in the string won, and every 56 px target in cooking mode
was quietly 46 — and 44 on `IconButton`, which was overriding the height a
second time. Sizes are therefore chosen, never patched: `size="xl"` is the
56 px control, and `IconButton` passes `size="none"` so the button emits no
height for it to fight. If a caller needs a box the library does not have,
add it to the library.

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

**Importing fetches a URL a stranger chose, from inside the network.** That is
server-side request forgery in one sentence, so `SafePageFetcher` only speaks
http(s), re-checks every redirect hop, and refuses any host whose addresses are
private — `http://backend:8080` and `169.254.169.254` are pages like any other
without that. `app.import.allow-private-hosts` exists so tests can serve their
own fixtures; it must stay false everywhere else.

**Parse formats, not sites.** `RecipePageParser` implementations are found by
Spring and tried in `@Order`, so a site publishing nothing standard can get its
own parser later without touching a registry. But the two that exist read
*schema.org* — as JSON-LD and as microdata — which is why Fooby and Cookidoo
worked without anyone writing a line for them. Site-specific parsers rot at the
first redesign; format parsers do not.

**A logged meal must copy its values, never reference the recipe.** Recipes get
edited after they have been used, so a meal log pointing at the live recipe
would silently rewrite someone's nutritional history every time they fix a typo
in the ingredients. Whoever builds the meal log copies title, quantities and
computed nutrition into the log row at the moment of logging. The recipe editor
already warns the author that edits apply to future uses only — that promise is
currently made by the copy and enforced by nothing, because there is no meal
log yet.

**The week plan is the opposite: it points at the recipe.** A planned meal is
an intention for a day that has not happened, so a recipe corrected on Tuesday
should be the one cooked on Thursday — `planned_meals` therefore holds a
`recipe_id`, and deleting a recipe takes its planned meals with it, because
nothing was cooked and there is no history to protect. The one thing the row
does store is `servings`, which belong to that evening rather than to the
recipe: they default to the household size at the moment of planning and never
move again, so changing the household does not silently rewrite what a dinner
for eight needs bought. `GET /api/plan/ingredients` is where the shopping list
will read those scaled quantities from; it exists now so that "the shopping
list updates" is provable before the list itself does.

**A day in the plan is a calendar day, not an instant.** All of `app/lib/week.ts`
computes in UTC and formats with `timeZone: "UTC"`, and the backend normalises
any date to its Monday with the same rule the client uses. Local `Date`
arithmetic gets this wrong twice a year — 2026-03-29 is 23 hours long in Zurich,
so "add one day" lands on the 29th again and Sunday's dinner becomes Saturday's
— and a date formatted in the runtime's own zone renders one day on the server
and another in the browser, which surfaces as a hydration error rather than as
the timezone bug it is. `todayIso` is the deliberate exception: which day *today*
is can only be answered locally, so the server answers it once and passes it down.

**The plan belongs to a household, not to a person.** Everyone owns exactly
one, created the first time they plan anything, and `planned_meals.household_id`
is the whole of sharing: everyone looking at the same household sees the same
rows, with no query anywhere having to remember to widen itself.
`created_by` says who put a meal there — it survives that account being deleted
(`ON DELETE SET NULL`), because the point of a shared plan is knowing somebody
already thought about Thursday. `households.size` is how many people it cooks
for, which is not how many accounts are in it: children eat without having one.

**One rule decides which plan you are looking at.**
`HouseholdService.activeHouseholdFor` returns the household you are a member
of *while its owner is entitled to share*, and otherwise your own. That single
condition is what makes cancelling safe: the member falls back to their own
plan, which was there and untouched the whole time, the owner keeps theirs, and
re-subscribing puts everyone back without anything having to be rebuilt.
Nothing is deleted on a lapse — the pricing page promises exactly that, and a
shared household is the easiest place to break the promise.

**Sharing a plan is not sharing a library.** A member may read a recipe that is
*on the shared plan* — otherwise the plan is a list of titles nobody can open —
and nothing else. That is `RecipeAudience`, an interface the recipe package
owns and the plan package implements, because the fact lives in planning and
recipes reaching into planning would put the two in a circle. It is read
access only: every write still goes through `owned()`.

**One enum holds the paid boundary.** `Feature` maps each paid capability to
the tier that opens it, `Entitlements.require` is the only check, and a refusal
is **402**, not 403 — nothing is wrong with the account, and the way past it is
a plan rather than a permission. Nothing else may compare tiers, or the pricing
page becomes a claim instead of a description.

**Nobody can pay yet, and the schema is not pretending otherwise.** Asking for
a plan writes a `subscription_orders` row that stays PENDING; a subscription is
only ever written by `SubscriptionService.confirm`, which is the method a
payment webhook will call and is idempotent because providers retry. The screen
asks `canOrder` before offering anything — a button that takes an order nobody
can settle is worse than a screen saying the plan is not open yet.

**`app.subscription.self-activate` hands out paid plans for free.** With it on,
ordering a plan grants it immediately; it exists because the tests and the dev
environment have to exercise a paid feature and there is no provider to
exercise it through. It is set in `docker-compose.dev.yml`, in the backend test
properties and on the CI e2e container — and it must stay false everywhere a
real person can reach, exactly like `app.import.allow-private-hosts`.

**An unhydrated page cannot report its own failure.** When React does not
hydrate, every control renders perfectly and does nothing: a form falls back to
a native submit, so the page reloads and the fields empty, with a clean console
and a clean terminal. No client-side handler can say so, because none are
running. `HydrationBanner` is the answer — server-rendered, removed the instant
React takes over, and held back four seconds by `.reveal-late` so a healthy page
never flashes it. If a control ever seems inert, that banner appearing is the
diagnosis.

**Cooking mode reads the recipe and never writes to it.** That is what makes
it safe to scale the quantities on screen for six people without touching a
recipe written for four, and what lets it work with no network at all. The
session it keeps — step, servings, ticked ingredients, running timers, and a
copy of the recipe — lives in `localStorage` under one key, so it survives a
dead network and dies on sign-out. It does not follow the cook to another
device; that would need the backend and is a story of its own.

Two rules there are worth keeping. Timers store the wall-clock instant they
are due and recompute from it, because an interval alone is throttled to a
crawl in a hidden tab and comes back wrong by exactly the minutes the cook was
away. And the wake lock has to be re-acquired on `visibilitychange`: the
browser drops it every time the tab hides, so taking it once is the bug that
looks like it works.

**`navigator.onLine` is not a network check.** It reports that an interface
exists, not that anything is reachable — under Playwright's offline emulation
it says "online" while every request fails. Where the app needs to know, it is
told: the service worker serving the offline shell is a fact, that flag is a
guess.

**The service worker caches two things and refuses everything else.**
Content-hashed assets under `/_next/static`, which cannot be stale in a way
that is wrong, and one offline page per locale. No page carrying a session is
ever cached, because a worker that cached pages will eventually serve one
person's signed-in HTML to the next and nothing in a test suite would say so —
`e2e/cooking-offline.spec.ts` walks the caches and asserts it. It registers in
production only, and unregisters itself anywhere else: the dev server rebuilds
chunks under the very paths a worker would be holding. Its version comes from
the build id on the script URL, which is what makes a release install a new
worker and drop the previous one's caches.

**Responsive is an acceptance criterion, not a polish pass.** Every screen has
to hold up from a narrow phone to a wide desktop before a story is done — no
horizontal body scroll, no control pushed off-screen, no label truncated into
meaninglessness. Where space runs out, decide what to drop: the recipe editor's
stepper keeps only the current step's label below `sm`, so three labels cannot
squeeze the connectors to nothing, and the header's sign-out button drops to its
icon there. The app nav wraps onto a line of its own below `sm` for the same
reason: that bar has about 80px to spare and two readable labels want twice
that, so keeping them in the row pushed the theme toggle off a 375px screen. Check a narrow viewport in the browser, not only a wide one.

When a control loses its visible label that way, give it an explicit
`aria-label`. Hiding the text with `sr-only` alone has bitten this codebase
twice: the button keeps its name, but a button whose label is `hidden` has none
at all.

**A green local suite can be testing files the repository does not have.**
`.gitignore` carried a bare `target/` for Maven, which is unanchored and so
swallowed `app/api/nutrition/target/` too: the onboarding preview route lived
on disk, passed every local run, and never existed in CI. `git status` said
nothing, because an ignored file is not untracked. When something works locally
and only fails in CI, check `git check-ignore -v <path>` before anything else.

**`getByRole("alert")` matches two nodes in e2e.** Next.js keeps its own
`__next-route-announcer__` in the DOM with `role="alert"`, so a page-wide query
is always a strict-mode violation. Scope the query to the form or give the
message a `data-testid`. It does not reproduce in unit tests, because jsdom has
no route announcer — so a green Vitest run proves nothing here.

**The e2e run must never share `.next` with the dev container.** It does
`npm run build`, a production build, into the same bind mount the dev server is
serving from — which wipes the chunks the already-loaded pages reference. The
symptom is brutal and silent: pages still render server-side, every script
returns 403, React never hydrates, and *every button in the app does nothing*,
with a clean terminal on both sides. `next.config.ts` reads `NEXT_DIST_DIR` and
`playwright.config.ts` sets it to `.next-e2e` for exactly this reason. If the
app ever goes inert in the browser while the e2e suite passes, check for
refused `/_next/static/chunks/*` before suspecting anything else.

Playwright browsers are not in the dev image, so `test:e2e` runs through the
official Playwright image instead — see the README for the command. The e2e
suite pins the browser locale to `fr-FR`, since the next-intl proxy negotiates
the redirect from `/` off `Accept-Language`.
