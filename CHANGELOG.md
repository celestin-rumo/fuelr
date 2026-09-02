# Changelog

Every release of Fuelr. Each entry is the same text as the matching file in
[`releases-notes/`](releases-notes/) — that folder holds one file per version,
this file collects them newest first.

---

# v1.0.1 — 2026-09-02

A fix release. v1.0.0 shipped with a home page whose main call to action did
nothing at all.

## Fixed

- **Five marketing buttons led nowhere.** The header's "Essayer gratuitement",
  the hero's "Commencer — c'est gratuit", the closing band's "Créer mon compte"
  and all three pricing plans were `<Button>` elements with no handler and no
  link: rendered perfectly, entirely inert. No visitor could reach sign-up from
  the home page. They are links now, and an end-to-end test clicks all six and
  asserts where each one lands — a button that renders is not a button that
  works, and only asserting the destination catches the difference.
- **The hero's secondary action nested a button inside a link**, which is two
  interactive elements where the markup promises one. Buttons that navigate are
  now anchors styled with `buttonClasses()`.

## Development tooling

Not visible in production, but it cost a day of false diagnosis and is worth
recording.

The end-to-end suite runs `npm run build` — a production build — into the same
bind mount the development container serves from, overwriting `.next` under the
running dev server. The pages already sent then referenced chunks that no
longer existed: every script returned 403, React never hydrated, and **every
button in the application stopped working**, while the API answered 200 to
everything and the test suite stayed green against its own build. Sign-up,
sign-in and password reset all appeared broken and none of them were.

`next.config.ts` now reads `NEXT_DIST_DIR` and the e2e run sets it to
`.next-e2e`, so the two builds no longer collide.

## Continuous integration

Making the pricing plans real links pulled next-intl's navigation into their
unit test, where `next/navigation` — a package subpath export — was left to
Node's ESM resolver and read as a file path. The development container
happened to resolve it, so the failure appeared only in CI and only after the
v1.0.1 tag was pushed: the build failed and nothing was ever deployed. Vitest
now processes next-intl rather than externalising it, and the plan CTA is
asserted as a link with a destination instead of a button.

## Verification

40 unit tests and 97 end-to-end tests, the unit suite run in a clean container
rather than the development one — the difference between the two is what let
the CI failure through. Beyond the suites, the part that actually mattered: a real
browser, through the development stack rather than the test server, creating an
account from the home page's call to action and receiving the confirmation
email — checked again after a full e2e run, which is what used to break it.

---

# v1.0.0 — 2026-09-01

The first release anyone can actually use. Before it, the repository held a
Next.js scaffold and a guarded `/app` with no way to sign in: reaching the
product meant calling `/api/auth/login` by hand from the browser console. This
release closes that gap and everything around it — the public site, the recipe
library, the nutrition engine, accounts, and the onboarding that leads into
them.

## Accounts and sessions

- **Sign in, stay signed in, sign out for real.** One `sessions` row per token
  issued, stored hashed. Signing out closes *that* device; changing a password
  closes every one. A version counter on the account would have been cheaper and
  would have signed out the phone when someone left a shared computer.
- **A progressive delay after three failed attempts**, counted in the database
  rather than in memory, so a restart does not clear it and two instances share
  the same count. An unknown address never advances the counter.
- **Password reset** — single-use links valid for 30 minutes. Only the SHA-256
  of the token is stored, so a leaked backup hands out nothing. Using a link
  closes every session: whoever knew the old password is signed out everywhere.
- **Sign-up** with a strength meter that lists the four rules rather than
  grading with one word — "medium" tells nobody what to change. An address
  already registered is reported under the field, with a link to sign in that
  carries the address so it is not typed twice.
- **Email verification that blocks nothing.** The account works from the first
  second; `/api/auth/me` reports whether the address is proven and a dismissible
  banner asks. Links last a week, and clicking one twice is a success — people
  re-open emails, and telling them the confirmation failed would be both false
  and alarming.
- **No endpoint reveals whether an account exists.** Sign-in and password reset
  answer identically — same status, same body, and the same *timing*: mail is
  sent off the request thread precisely so a reset does not take measurably
  longer for a real address. Registration is the single exception, because the
  person is standing at the form and needs sending to the login screen.

## Onboarding

- **`/commencer`: three questions, then the numbers, then the account.** The
  preview is the reason anyone signs up, so it cannot sit behind a sign-up.
- **`NutritionTargetService`**, deliberately separate from `NutritionService`:
  one says what is in a dish, the other what a person needs in a day. Mifflin-St
  Jeor, an activity factor, then a percentage shift for the goal — percentages
  rather than a flat 500 kcal, which is gentle at 3000 and severe at 1700. A
  floor stops the arithmetic producing a target nobody should eat to.
- **Answers live in `localStorage`** until there is an account to attach them
  to, so closing the tab loses nothing and coming back says so. Attaching them
  at sign-up is allowed to fail: the account exists either way.

## Recipes

- **A draft that exists from the first click.** There is no "new recipe" form —
  landing on the route creates the recipe and hands over the editor, so from the
  first keystroke there is something to save into.
- Keyboard chaining through name, quantity and unit; reorderable steps, with
  blank ones dropped at save; status derived from the content rather than
  toggled by hand.
- **Library**: grid with duration and macros, pinned favourites with a manual
  order, search and filtering, duplicate, delete, export.
- **Photos** on a mounted Docker volume, resized on upload.
- The editor was reworked twice after usability feedback: grouped ingredients,
  a visible stepper, navigation that stays in one place, and a layout that holds
  at 375px.

## Nutrition

- Energy and macros computed **on the server**, so the web app and the future
  native app produce the same numbers from the same reference table. A client
  computing its own would drift the moment either shipped.
- Per-serving figures update live as ingredients are added. Lines no reference
  food matched are flagged as estimated rather than presented as measured.

## Public site

- Home, features, pricing, about and contact, built from the Claude Design
  artboards.
- The paid/free split is explicit, and **every AI feature is paid** — importing
  a recipe from a photo of a cookbook or from a URL is not part of the free
  plan.

## Design system

- Tokens in `globals.css` carrying both themes, so no component needs a `dark:`
  class: `bg-bg-raised` and `text-text` are enough.
- Thirteen components under `app/components/ui/`, each with colocated tests, and
  a `/design-system` page that renders from the real tokens rather than
  describing them — if a change looks wrong there, it is wrong.
- Dark by default and `enableSystem={false}`: dark is a brand decision, not a
  preference.

## Internationalization

- `fr` (default), `en`, `de`, with a translated slug per route —
  `/fonctionnalites` never surfaces as `/features` on the French site.
- Translation is an acceptance criterion, not a follow-up: a hardcoded string is
  a failed criterion.

## Infrastructure

- Three Docker Compose environments (dev / staging / prod). There is no
  host-Node or host-Maven workflow.
- Dev ports are configurable through `.env`, so the stack coexists with other
  projects on the same machine.
- CI builds and pushes images to GHCR; `main` and version tags deploy
  production, `dev` deploys staging.
- Mail through Mailpit in development and Resend in staging and production.

## Database migrations

`V3__auth` · `V4__nutrition` · `V5__recipes` · `V6__recipe_favourites` ·
`V7__favorite_rank` · `V8__recipe_photo` · `V9__sessions` ·
`V10__password_reset` · `V11__email_verification` · `V12__profiles`

Ten migrations against a database that has none of them.

## Notable fixes

- **Every failure on a public endpoint returned 401**, including a wrong
  password. Spring re-dispatches to `/error` as a fresh, unauthenticated
  request, and that dispatch was not permitted. MockMvc does not replay it, so
  the suite stayed green while signing in was impossible.
- **Every marketing page scrolled 88px sideways at 375px.** A `hidden` class
  passed to `Button` never hid anything: the component sets `inline-flex`
  itself, and `.hidden` is emitted earlier in the stylesheet, so the class list
  lost to the cascade.
- **The sign-out button pushed every `/app` page sideways** at the same width.
  It now drops to its icon below `sm`, with an explicit `aria-label` — a button
  whose label is merely hidden has no accessible name at all.
- **The backend failed to start where no media volume was mounted**, taking
  every Spring test context down with it rather than only the upload tests.
- Deployment secrets: `JWT_SECRET` now reaches both servers, the sender address
  is pinned, and the Resend key is read from the secret that actually holds it.

## Not in this release

- **No meal log yet.** When it is built, a logged meal must copy its values and
  never reference the recipe: recipes get edited after they have been used, and
  a log pointing at the live recipe would rewrite someone's nutritional history
  every time they fixed a typo. The recipe editor already promises that edits
  apply to future uses only — a promise currently made by the copy and enforced
  by nothing.
- No AI import (photo or URL), no shopping list, no native app.

## Deploying this release

- **DNS**: `fuelr.celestinrumo.ch` and `www.fuelr.celestinrumo.ch` must resolve
  to the Traefik host.
- **Resend**: the sending domain must be verified in their console. An
  unverified domain is refused at the first send, which here means password
  reset and email confirmation both fail silently. The SMTP username is a fixed
  value, not the sender address.
- **Secrets**: `JWT_SECRET` and `RESEND_API_KEY` for both environments.
  `MAIL_PASSWORD` and `STAGING_MAIL_PASSWORD` are no longer read.

## Verification

85 backend tests, 40 unit tests, 95 end-to-end tests. Beyond the suites: every
screen was rendered and looked at from 375px to desktop, a copied token was
confirmed dead after signing out, and a reset link was followed from Mailpit
through to a changed password.
