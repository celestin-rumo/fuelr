/**
 * Fuelr's service worker.
 *
 * It caches two things and refuses everything else, and the refusal is the
 * design. A worker that cached pages would sooner or later serve one person's
 * signed-in HTML to the next, and nothing in a test suite would say so.
 *
 *   1. `/_next/static/**` — content-hashed and immutable, carrying no session.
 *      A stale entry there cannot be wrong: a different build has different
 *      file names. This is what lets the app open with no network.
 *   2. One offline page per locale, precached on install. It is served when a
 *      navigation cannot reach the network, and it is where cooking carries on
 *      — the dish under way is stored on the device, not fetched.
 *
 * Everything else, `/api/**` first among them, goes to the network or fails.
 *
 * Versioning comes from the `?v=` on the script URL, which the registration
 * sets to the build. A new build therefore installs a new worker, refreshes
 * the offline pages, and drops every cache that is not its own — without which
 * a released page would keep resolving to the one before it.
 */

const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const STATIC_CACHE = `fuelr-static-${VERSION}`;
const SHELL_CACHE = `fuelr-shell-${VERSION}`;

const LOCALES = ["fr", "en", "de"];
const shellFor = (locale) => `/${locale}/offline`;

/**
 * The page and the scripts it needs.
 *
 * Caching the HTML alone is the trap: it renders, nothing hydrates, and the
 * offline page is a screenshot of an app rather than the app. Its assets are
 * read out of its own markup — Next names every chunk and font it preloads
 * right there — and they are content-hashed, so caching them is safe.
 */
async function precacheShell(locale) {
  const response = await fetch(shellFor(locale), { credentials: "same-origin" });
  if (!response.ok) return;

  const html = await response.clone().text();
  await (await caches.open(SHELL_CACHE)).put(shellFor(locale), response);

  const assets = new Set(
    [...html.matchAll(/\/_next\/static\/[^"'\s>\\]+/g)]
      .map((match) => match[0])
      .filter((path) => /\.(js|css|woff2?)$/.test(path)),
  );
  const statics = await caches.open(STATIC_CACHE);
  await Promise.allSettled([...assets].map((path) => statics.add(path)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      // allSettled: one locale failing to precache must not leave the worker
      // uninstalled and the other two unserved.
      await Promise.allSettled(LOCALES.map(precacheShell));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (!name.endsWith(`-${VERSION}`)) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

/** Sign-out: nothing of this account survives on a shared machine. */
self.addEventListener("message", (event) => {
  if (event.data !== "fuelr:sign-out") return;
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) await caches.delete(name);
      await self.registration.unregister();
    })(),
  );
});

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;

  const response = await fetch(request);
  // Only a clean, complete response: caching an error would pin it there for
  // the life of the build.
  if (response.ok && response.status === 200) {
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkThenShell(request, url) {
  try {
    return await fetch(request);
  } catch {
    const locale = LOCALES.includes(url.pathname.split("/")[1])
      ? url.pathname.split("/")[1]
      : LOCALES[0];
    const cache = await caches.open(SHELL_CACHE);
    const shell = await cache.match(shellFor(locale));
    if (shell) return shell;
    throw new Error("offline, and no shell to show");
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never a session, never an answer about an account.
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkThenShell(request, url));
  }
});
