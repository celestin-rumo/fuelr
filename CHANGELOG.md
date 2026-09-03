# Changelog

Every release of Fuelr. Each entry is the same text as the matching file in
[`releases-notes/`](releases-notes/) — that folder holds one file per version,
this file collects them newest first.

---

# v2.1.1 — 2026-09-03

One unreadable ingredient emptied a whole library, and it stayed empty.

## What happened

An import from a photo wrote `piece` as a unit. This app knows five — `g`,
`ml`, `pcs`, `c.à.s`, `c.à.c` — and the tool schema handed to the model said
"g, ml, cs, cc, piece", three of which do not exist here.

From then on `GET /api/recipes` answered 400 for that account. The library
reported itself empty, with every recipe still in the database, and reloading
changed nothing: the unit is written into the row, so the damage outlived the
import that caused it. The recipe had no description either — the schema never
asked for one — and the filter chips were gone with the grid they belong to.

## Fixed

**A display no longer refuses to render because one line is unreadable.**
`NutritionService.computeForDisplay` answers "no figures" where `compute`
throws, and the library and the week's plan ask through it: a card loses its
numbers rather than its existence. `compute` still throws for the editor, where
somebody typed the unit and can correct it — and that path answers 400 rather
than the 500 it used to.

**A missing unit stops being an error.** Every import produces such lines on
purpose — "sel, poivre", "une poignée de coriandre" — as a line it could not
split, marked for review and left whole. They count as nothing and the recipe
keeps its figures: denying figures to most imported recipes is a worse answer
than figures that ignore a pinch.

**The reader speaks the app's vocabulary.** The five real units, checked
against on the way in, because a schema is a request and not a promise. Tags
too: the library's chips are a fixed list, so a recipe tagged "soupe" is a
recipe no filter will ever find — the model picks from the list or picks none.
And the description is asked for, which was simply missing.

**The rows already written are repaired.** `V22__imported_units.sql` maps the
spellings this app has never been able to read onto the ones it can. It touches
nothing it could already measure, which makes it a repair rather than a change.

## Verification

Backend 265, frontend unit 200, e2e 183. The regression test inserts a bad unit
straight into the database rather than through the import: the door is fixed,
but the door is not the only way a row gets written, and the state is what the
fix has to survive.

Seasons are deliberately still not asked of the model. `Season` is a closed
domain on purpose, and letting something guess one is a product decision nobody
has made.

---

# v2.1.0 — 2026-09-03

Everything is free, including the parts that cost money to run — and what
bounds them is a ceiling on the invoice rather than a wall in front of a cook.

## Every feature is open, the metered ones included

v2.0.0 opened every paid feature except the ones billed per call: reading a
photo or a screenshot stayed behind a plan, on the grounds that giving away
something billed per call is not a gesture but a bill.

That was the wrong instrument. No payment provider is wired, so nobody can
subscribe — the exception protected no margin and simply made the feature
unreachable, including for the household the launch period exists for. It is
gone. `Entitlements.has` now opens everything while `app.subscription.enforce`
is off.

`Feature.metered()` stays and still says which capabilities carry an external
cost. It is read by the budget now rather than by the entitlement check.

## Two ceilings, in money

- **10 CHF a month, per account.** One budget for everybody while nothing is
  charged: during the launch the tier does not decide, since an account that
  ordered nothing and one that granted itself a plan are in exactly the same
  position. At the measured 1.8 US cents a read, that is roughly seven hundred
  photos.
- **50 CHF a month, across every account.** The per-account figure is not a
  bound on anything: this app is public, and ten francs multiplied by however
  many strangers register is an open invoice. This second ceiling is the one
  that actually answers that question.

Whichever is reached first refuses, with the same message — from where somebody
stands, a spent month is a spent month, and it has a date: the first of the
next.

Both are configuration, in US cents, because that is the unit the provider
bills in. A figure in francs in the code would carry an exchange rate to be
wrong about on top of a number that is otherwise exact.

Once the paid boundary is switched on, none of this changes shape: the tier
decides again, and a free account never reaches a budget at all — it is refused
the feature first.

## Smaller

- `/total-costs` says where the month stands against the global ceiling, since
  that is the figure the page exists to inform a decision about.
- The import screen carries the launch note beside the assisted sources: a read
  that is being given away is worth naming as a gift rather than becoming a
  surprise the day it stops.
- Two tests that passed locally and failed in the pipeline, both for the same
  reason — they asserted an environment rather than a rule. The operator's page
  signed in with the development admin address while CI starts its backend with
  another; and the import spec assumed a reader was wired, when CI runs with no
  Anthropic key on purpose. Both now assert what holds either way.
- The v2.0.0 notes listed reading a page of a book as still to build, three
  paragraphs after describing the photo import that does it. Corrected in the
  notes and on the published release.

## Verification

Backend 260, frontend unit 200, e2e 183. The two ceilings have a test of their
own: one account spends past the global total while well inside its own budget,
and a second account that has spent nothing is refused.

## What is left

Unchanged from v2.0.0, minus one line: **nothing about payment works yet** and
that is still the largest ticket; **the backup gap** is still the one where
waiting costs data; **two AI features** are specified and unbuilt — reading an
unstructured page, and estimating a photographed plate; **the public site is
not translated**.

New in the backlog: an epic **Créer menu** — say what you have and get dishes
suggested, from any screen — and a task to put a live Anthropic key in each
environment, which is what stands between the assisted import working in
development and working for a family.

---

# v2.0.0 — 2026-09-03

The release where Fuelr stops being a recipe box. A week can be planned, turned
into a shopping list, cooked with no signal, written down and measured — and a
recipe can now arrive from a link, a photo or a screenshot.

It is a major version for one reason beyond the size: **every paid feature is
open to everybody, and one flag starts charging.** Nothing about the boundary
was removed, and nothing that gets turned on later takes away what was written
in the meantime.

## The week

- **A week of meals.** Seven days, three slots, drag on a desktop and tap on a
  phone. A planned meal points at the recipe rather than copying it — a recipe
  corrected on Tuesday is the one cooked on Thursday — but its `servings`
  belong to that evening and never move again, so changing the household does
  not silently rewrite what a dinner for eight needs bought.
- **A day is a calendar day, not an instant.** Every date is computed in UTC
  and formatted in UTC. Local arithmetic gets this wrong twice a year: 2026-03-29
  is 23 hours long in Zurich, so "add one day" lands on the 29th again and
  Sunday's dinner becomes Saturday's.
- **The plan belongs to a household**, not to a person. Everyone owns exactly
  one, and `planned_meals.household_id` is the whole of sharing — everybody
  looking at the same household sees the same rows, with no query anywhere
  having to remember to widen itself.

## The shopping list

- **Generated from the plan, and stored rather than derived.** A ticked box is
  a fact about somebody standing in a shop, so it survives the plan changing
  under it: reading the list regenerates it, and the merge leaves every tick and
  every hand-added line exactly where they were. That is why there is no
  "regenerate" button — a list that only followed the plan when somebody
  remembered to press one would be wrong most of the time.
- **A cupboard.** What is already at home is deducted from what has to be
  bought, and cooking a planned meal takes it off the shelf.
- **It works with no signal.** Every tick is attempted against the server and
  whatever fails is kept on the device until a later attempt succeeds. Each tick
  carries the instant it happened, not the instant it syncs, so a phone coming
  back from a basement cannot undo a tick made after it.

## Cooking mode

One step per screen, 56px controls for a hand covered in flour, timers read out
of the step's own text, and a screen that stays awake. It reads the recipe and
never writes to it, which is what lets it scale the quantities for six people
without touching a recipe written for four — and what lets it work with no
network at all.

## Nutrition, and a diary

- **A real food table**: 1 216 foods from the Swiss Food Composition Database,
  with names in three languages, macros and twenty-odd micronutrients. It is
  imported from the published workbooks and re-imported when their checksum
  changes, so following an upstream release is a regenerate and a boot, never a
  hand-edited migration.
- **More data made matching harder, not easier**, and that was the real work.
  The matcher normalises, cuts a written name into words and tries every run of
  consecutive words longest-first against three indexes. It is held to 90% over
  288 real ingredient lines and sits at 91.3%, printed on every run.
- **A diary that copies its values.** A logged meal stores the figures as they
  were at the moment of logging, so correcting a recipe in June cannot rewrite
  what was eaten in March. Writing the diary is free; measuring yourself against
  a target is what the paid plan adds.
- **Nothing on that screen congratulates, blames or counts a streak.** An
  average is taken over the days that were written down, never over seven — a
  blank day is a day nobody recorded, not a day of eating nothing.

## Recipes

- **Seasons**, as four closed values rather than a tag: "show me what is in
  season" has to be derivable from the date, and it cannot be if the value is
  whatever somebody typed. Filtering by two seasons asks for *either*.
- **Step suggestions** on `/`, from a catalogue written in advance in three
  languages. The trigger only fires at the start of a field or after a space,
  which is what keeps "1/2 citron" typable.

## Importing a recipe: three ways in

- **A link**, free and unlimited, read as schema.org — JSON-LD and microdata.
  That is why Fooby and Cookidoo worked without anybody writing a line for
  them: site-specific parsers rot at the first redesign, format parsers do not.
- **The photo the page published** now comes with it, in all four shapes
  schema.org allows for `image`, including an `@id` pointing at an ImageObject
  elsewhere in the graph.
- **A photo or a screenshot**, read by Claude. A page of a cookbook, a recipe
  card, a capture of another app. What comes back is a draft with its guesses
  flagged — a line the model could not split keeps the whole line and says
  `needsReview` — because a model is not a reason to start presenting an
  invention as a measurement.

Two rules bind that last one. The images are written by a stranger: a page can
be photographed with "ignore your instructions" written across it, so the model
may only answer through a declared tool schema and nothing it returns is ever
treated as an instruction. And the URL of an imported photo is as untrusted as
the page it came from, so it is fetched through the same guard — http(s) only,
every redirect re-checked, any host resolving to a private address refused —
with the file's real type read from its first bytes rather than from a header
anybody could write.

## The offer

- **Everything is free right now, and that is one flag.**
  `app.subscription.enforce` is off, so every feature is open and no screen
  shows a wall. Where a paywall used to be there is a note saying the feature
  will be paid for later: a target somebody will pay for is not a target they
  own, and finding that out on the day it stops being free is the version of
  this that breaks trust.
- **The exception is anything metered.** Reading a photo is billed to us per
  call, so it stays behind the plan whatever the flag says — "everything is
  free" is a sentence about our own features, not about somebody else's
  invoice.
- **A budget in money, not a count of calls.** `ai_usage` keeps one row per
  read with the tokens the provider counted; a two-page recipe costs twice a
  one-page one and says so, a price change does not silently double what
  everybody gets, and a new kind of read needs no new counter. A spent month is
  429, not 402: the plan is paid for, and the wait has a date.
- **The payment seam is in place and inert.** `PaymentProvider` is written in
  the vocabulary every provider shares and in nobody's SDK; the webhook is
  public by necessity and answers 501 while nothing is wired. Prices moved out
  of the message catalogues — three strings in three languages — into
  configuration, served by `GET /api/plans` without a session.

## Interface

- **360px is the floor, and it is measured rather than argued about.** A suite
  opens every screen at 360×640 and asserts three things: no sideways scroll,
  no control under 44px, and the bottom of a dialog reachable on a 360×480
  screen. It found four targets nothing else had.
- **A phone is not a small desktop.** Below `lg` the planner offers one add
  button per day instead of 21 empty slots; below `sm` the library folds eleven
  rows of filters behind one chip that carries the count. The journal puts the
  meals somebody came to read above the targets they set once a month.
- **One dialog for the whole app.** The version each screen wrote for itself
  centred a card and let it grow: on a short screen that put "Retirer du
  planning" 218px below the fold with nothing to scroll.
- **Undo where it is cheap, a question where it is not.** Deleting a meal or a
  hand-added shopping line is one tap with a way back; showing a household
  member out is asked first, with the name in the question.

## Operations

- **`/privacy`** says what leaves the app and where it goes: the AI features,
  processed by Anthropic in the United States; the mail relay; and the import,
  which fetches a page from our servers rather than the visitor's browser. It
  claims nothing the code does not do — no hosting country, no retention
  period, and account deletion described as what it currently is.
- **`/total-costs`**, admin only, reads the usage rows back: the month beside
  the total, per operation and per account, with each account's ceiling on its
  own line. Figures in dollars, as the provider bills them.

## Verification

Backend 257, frontend unit 199, e2e 182 — all green on the merge commit. The
assisted read was also exercised end to end against the real API on a generated
cookbook page: eight ingredients, six steps, the two unsplittable lines flagged,
1.76 US cents and nine seconds.

The suite itself touches no network anywhere. The provider, the recipe sites and
the mail relay all have local stand-ins, which is what makes it possible to
assert that the tokens a provider reports are the ones billed.

## What is left

**Nothing about payment works yet.** A plan cannot be bought: no provider is
chosen, so `canOrder` is false and the screen says the plan is not open yet.
Choosing one means writing one class behind `PaymentProvider` — the checkout,
the signed webhook and the invoices are the remaining work, and they are the
largest ticket in the backlog.

**The assisted import needs its key in place per environment.** Without one it
reports itself unwired, which is a working state and not a broken one. CI
deliberately has no key: every read is billed, and a key in the pipeline would
mean a paid request on every push.

**Two AI features are specified and unbuilt**: reading a blog that publishes no
structured data, and estimating a photographed plate. The seam they plug into
exists — what is missing is the prompt and the fixtures. Reading a page of a
book is *not* among them: that is the photo import above, and it works. The
reader only takes images today, which is exactly why the unstructured page is
still a story: it needs the same model reading text, tried after the two
schema.org parsers.

**The backup is the gap that costs data.** The `recipe_media` volume is in no
backup today, and neither is Postgres. Losing the volume loses the photos
without the database saying anything: the rows would point at files that are no
longer there. That is a ticket, and it is the one where waiting has a price.

**Two smaller things worth naming.** The marketing catalogues (`site.json`) are
French in all three locales, so the public site is not actually translated. And
no page on the public site carries an `h1` — `SectionHead` renders an `h2`
everywhere — which belongs with the accessibility ticket rather than with a
one-line fix.

**Household profiles are half done.** Sharing works, invitations work, and
per-person preferences and allergies do not exist at all.

---

# v1.0.3 — 2026-09-02

Four deployment faults, all invisible from the code and all found by looking at
the running site. v1.0.2 was correct and still could not send an email, still
showed a translation key instead of an error, and still resolved the wrong
backend.

## Fixed

- **The frontend was reaching another project's API.** `BACKEND_INTERNAL_URL`
  was never set on the servers, so it fell back to `http://backend:8080`,
  resolved on the shared `traefik-proxy` network — where four projects each
  declare a service called `backend`. Compose publishes the *service* name as a
  network alias on every network a container joins, so unique container names
  did not help. Measured, not assumed: reproducing the topology locally, twelve
  lookups of `backend` returned our container seven times and another project's
  five. Every server-side call the frontend made, the session guard included,
  was a coin toss. The frontend now sits on the project's private network and
  addresses the backend by its container name, which is unique host-wide and
  cannot drift back.

- **`/api` never reached the app's own route handlers in production.** Traefik
  matched it ahead of the frontend, so requests went straight to Spring: a
  wrong password came back as Spring's error body and the screen showed the raw
  key `auth.form.errors.Unauthorized`. Those handlers are also what set the
  session cookie. Traefik no longer routes `/api` on the site's hostname. The
  public API the native client will need gets a hostname of its own — it cannot
  share a path with the web app.

- **No email was ever sent.** Resend answered `535 Invalid username` on every
  attempt. Its SMTP user is the literal string `resend`, never the sender
  address and never the API key — as fixed as the host beside it, which the
  compose file already hardcoded. It is no longer a secret, because a value
  that can only be one thing should not live somewhere it can be typed wrongly.
  `MAIL_USERNAME` and `STAGING_MAIL_USERNAME` are now unread and can be
  deleted.

  The failure was silent by design: a mail error must not reveal which
  addresses exist, so the only trace was one line in the backend log.

- The staging router kept a middleware label pointing at a router that no
  longer existed.

## Verification

The full pipeline, e2e included. The parts that only production and staging can
show were checked there: the certificate is now issued by Let's Encrypt for
both hostnames, and staging was confirmed to sign in with a readable error and
to deliver its confirmation email.

---

# v1.0.2 — 2026-09-02

Makes failure visible. Two of the last three bugs looked identical from the
outside — a control that does nothing — and neither said a word.

## Added

- **`Banner`** (`app/components/ui/banner.tsx`) — error, success and info.
  Three tones, because the system gives one meaning per colour: an amber
  "warning" would have to borrow one that already means something else. Errors
  take `role="alert"` and interrupt, the rest take `role="status"` and wait
  their turn. Sign-in, sign-up and password reset now surface their failures
  through it instead of a bare line of text.

- **A page that admits when it is dead.** When React fails to hydrate, every
  control renders perfectly and does nothing: a form falls back to a native
  submit, so the page reloads and the fields empty, with a clean console and a
  clean terminal. No client-side handler can report that — none are running. So
  the banner is rendered by the server and removed the instant React takes
  over, which means it stays put forever when React never does. It waits four
  seconds before showing itself, so a healthy page never flashes it; the
  reduced-motion rules collapse durations, not delays, so the wait survives
  there too. Its way out is a link with an empty href rather than a button:
  nothing is listening for a click.

## Fixed

- **The production certificate.** The site was serving `TRAEFIK DEFAULT CERT`
  and every visitor got a browser warning. `www.fuelr.celestinrumo.ch` had no
  DNS record, and because the router matches both hosts in one rule, Traefik
  asks Let's Encrypt for a single certificate covering both — which validates
  each name separately. The unresolvable name failed the whole issuance and
  took the working host down with it, over a hostname nobody was using. The
  record now exists; the rule keeps both hosts, with a comment next to it
  saying why each must resolve before the first deploy.

- The frontend was missing the `traefik.docker.network` label the backend
  already had.

## Known, not fixed here

On the production domain Traefik routes `/api` straight to the backend, ahead
of the frontend, so the app's own route handlers never run there. A wrong
password comes back as the raw key `auth.form.errors.Unauthorized` instead of
"Identifiants incorrects". Exposing the API publicly is deliberate — the native
client will need it — but it cannot share a path with the web app's handlers.
It needs a hostname of its own.

## Verification

45 unit tests, 99 end-to-end tests. The hydration banner was checked the only
way that means anything: by blocking the JavaScript chunks in a real browser —
opacity 0 at two seconds, 1 at five, form inert — and by confirming it is
absent from the DOM entirely on a healthy page.

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

The pipeline itself gained an `e2e` job, which runs the image the build just
pushed — not a rebuild from source — with a database, a mail catcher and the
backend behind it. Nothing downstream can tag or publish a release if it
fails, which is what would have stopped v1.0.0 shipping with a home page whose
main button did nothing.

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
