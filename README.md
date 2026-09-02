# Fuelr

Save your recipes and plan your meals for the week.

## Stack

- **Frontend**: Next.js 16 (App Router, TypeScript, Tailwind CSS v4), next-intl (fr/en/de), next-themes (light/dark)
- **Backend**: Java 21 / Spring Boot, Flyway, account management (Spring Security + Spring Mail)
- **Database**: PostgreSQL 17
- **Tests**: Vitest + Testing Library, Playwright (e2e), JUnit + Testcontainers on the backend
- **Infra**: Docker / Docker Compose, Traefik, GitHub Actions → ghcr.io

## Structure

```text
fuelr/
├── frontend/                  # Next.js 16 (App Router)
│   ├── app/
│   │   ├── [locale]/          # localized pages (fr by default)
│   │   │   └── design-system/ # living design system reference
│   │   ├── components/ui/     # reusable component library
│   │   ├── messages/          # fr / en / de translations
│   │   └── globals.css        # design tokens (colors, type, shape, motion)
│   ├── i18n/                  # routing, navigation, message loading
│   ├── e2e/                   # Playwright tests
│   ├── public/                # manifest icons, sw.js (production only)
│   └── proxy.ts               # next-intl middleware
├── backend/                   # Spring Boot
│   └── src/main/java/ch/celestin/fuelr/
│       ├── account/           # User, SecurityConfig, admin bootstrap
│       └── health/
├── database/                  # PostgreSQL
├── .github/workflows/         # build & push images, deployment
├── docker-compose.dev.yml
├── docker-compose.staging.yml
└── docker-compose.prod.yml
```

## Getting started (dev)

Everything runs in Docker — no Node or Java installation is needed on the machine.

```bash
docker compose -f docker-compose.dev.yml up --build
```

| Service    | URL                     |
| ---------- | ----------------------- |
| Frontend   | http://localhost:3000   |
| Backend    | http://localhost:8080   |
| PostgreSQL | localhost:5432          |
| Mailpit    | http://localhost:8025   |

The frontend is bind-mounted with hot reload; the backend restarts automatically on every change under `backend/src`.

## Design system

The design system is documented in [CLAUDE.md](CLAUDE.md) and rendered live at http://localhost:3000/fr/design-system — colour ramps, semantic tokens, type scale, spacing, shape, elevation, motion, and every component in all of its states. It renders from the real tokens, so it doubles as a visual regression check: dark is the default theme, and the toggle in the header mirrors everything into light.

## Account management

On the backend's first boot, an admin account is created automatically from the `ADMIN_EMAIL` (`admin@celestinrumo.ch`) and `ADMIN_PASSWORD` environment variables.

In dev, outgoing mail is never actually sent: it is caught by **Mailpit** at http://localhost:8025, so no real API key is needed locally.

Staging and production send through Resend: `MAIL_HOST` (`smtp.resend.com`), `MAIL_PORT` (`587`), `MAIL_USERNAME` and `MAIL_PASSWORD`. The deploy workflow fills `MAIL_PASSWORD` from the `RESEND_API_KEY` secret — for Resend, the SMTP password *is* the API key.

Mail is sent from `no-reply@celestinrumo.ch` (`MAIL_FROM`). **Resend refuses any send whose domain is not verified in its console**, so that domain has to be verified before the first transactional email goes out.

> **Note**: `SecurityConfig` currently permits all requests. It exists only to provide the password encoder used by the admin bootstrap — real authentication still needs to be built.

## Tests

The frontend checks run inside the frontend container (`docker compose -f docker-compose.dev.yml up` must be running):

```bash
DC="docker compose -f docker-compose.dev.yml exec frontend"

$DC npm run lint          # ESLint
$DC npm run typecheck     # next typegen && tsc --noEmit
$DC npm run test          # Vitest (unit / component)
$DC npm run test:coverage # Vitest + coverage
```

The e2e tests need the Playwright browsers, which are not in the dev image. They run in the official Playwright image instead:

```bash
docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -e CI=1 \
  -v "$PWD/frontend":/w -w /w \
  mcr.microsoft.com/playwright:v1.62.1-noble npx playwright test
```

On the backend: `docker compose -f docker-compose.dev.yml exec backend mvn test` (JUnit, Mockito, Testcontainers).

## Staging / Production

| Environment | URL                                      |
| ----------- | ---------------------------------------- |
| Production  | https://fuelr.celestinrumo.ch (+ `www.`) |
| Staging     | https://staging.fuelr.celestinrumo.ch    |

These environments consume images published to `ghcr.io/celestin-rumo/...` and are routed through an external Traefik reverse proxy (`traefik-proxy` network, see `infra-edge`).

Copy `.env.staging.example` → `.env` (or `.env.prod.example` → `.env`) and fill in the real secrets before starting:

```bash
docker compose -f docker-compose.staging.yml --env-file .env up -d
```

## CI/CD

Pushes to `main`, `dev` and tags build and publish the images to `ghcr.io`, then trigger an automatic deployment through a self-hosted runner (prod from `main`/tags, staging from `dev`). The image build is gated on the tests passing first (lint + typecheck + coverage on the frontend, `mvn test` on the backend).

Expected GitHub secrets (`Settings > Secrets and variables > Actions`):

- `POSTGRES_PASSWORD`, `STAGING_POSTGRES_PASSWORD`
- `ADMIN_PASSWORD`, `STAGING_ADMIN_PASSWORD`
- `RESEND_API_KEY` — the SMTP password for both environments
- `MAIL_USERNAME`, `STAGING_MAIL_USERNAME` — the Resend SMTP user
- `JWT_SECRET` — shared by both environments; rotating it signs every user out

`MAIL_PASSWORD` and `STAGING_MAIL_PASSWORD` are no longer read by anything: the
deploy workflow takes the key from `RESEND_API_KEY` instead. They can be
deleted.

`GITHUB_TOKEN` is provided automatically and needs no configuration.

## Useful commands

```bash
docker compose -f docker-compose.dev.yml logs -f    # logs for all services
docker compose -f docker-compose.dev.yml down       # stop
docker compose -f docker-compose.dev.yml down -v    # stop + reset the database
```
