"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Banner } from "@ui/banner";
import { Button, IconButton, buttonClasses } from "@ui/button";
import { cn } from "@ui/cn";
import type { Recipe } from "@app/lib/api";
import { armAlarm, askForNotifications, notify, sound, vibrate } from "@app/lib/alarm";
import { cookableSteps } from "@app/lib/cooking";
import { clock, durationsIn } from "@app/lib/durations";
import type { CookingSession } from "@app/lib/cooking-session";
import { clearSession, readSession, writeSession } from "@app/lib/cooking-session";
import { useCookingTimers } from "@app/lib/use-cooking-timers";
import { useHydrated } from "@app/lib/use-hydrated";
import { useWakeLock } from "@app/lib/use-wake-lock";
import { CookingIngredients } from "./cooking-ingredients";

/**
 * Cooking mode: one step per screen, and nothing that needs a precise gesture.
 *
 * It reads the recipe and never writes to it. That is what lets it work with
 * no network later, and what makes it safe to scale the quantities on screen
 * without touching what the author wrote.
 *
 * The surface is remounted once hydration is done, so it can seed itself
 * straight from the session on the device — see `useHydrated`. Before that it
 * renders exactly what the server sent: step one, which is also the right
 * answer when there is no session to come back to.
 */
export function CookingMode({ recipe }: { recipe: Recipe }) {
  const hydrated = useHydrated();
  return (
    <CookingSurface
      key={hydrated ? "live" : "server"}
      recipe={recipe}
      restore={hydrated}
    />
  );
}

function CookingSurface({
  recipe,
  restore,
}: {
  recipe: Recipe;
  /** False through hydration, when there is no storage to read yet. */
  restore: boolean;
}) {
  const t = useTranslations("cook");

  const steps = useMemo(() => cookableSteps(recipe), [recipe]);

  // Read once, on the render that mounts the live surface.
  const [stored] = useState(() => (restore ? readSession() : null));
  const foreign = stored !== null && stored.recipeId !== recipe.id;
  const mine = stored && !foreign ? stored : null;

  const [index, setIndex] = useState(() =>
    mine ? Math.min(Math.max(0, mine.stepIndex), steps.length - 1) : 0,
  );
  const [servings, setServings] = useState(() => mine?.servings ?? recipe.servings);
  const [ticked, setTicked] = useState<number[]>(() => mine?.ticked ?? []);
  const [sheet, setSheet] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [done, setDone] = useState(false);
  const [startedAt, setStartedAt] = useState(() => mine?.startedAt ?? Date.now());
  const [elapsed, setElapsed] = useState(0);
  /** Another dish already in progress. Nothing is stored until this is settled. */
  const [conflict, setConflict] = useState<CookingSession | null>(
    foreign ? stored : null,
  );
  const opener = useRef<HTMLButtonElement>(null);

  const last = index === steps.length - 1;
  const title = recipe.title?.trim() || t("untitled");

  // The screen stays on while there is cooking to do, and is given back the
  // moment there is not — including on the completion screen.
  useWakeLock(restore && !done);

  const formatDuration = useCallback(
    (minutes: number) => {
      const hours = Math.floor(minutes / 60);
      const rest = minutes % 60;
      if (hours === 0) return t("timers.minutes", { count: rest });
      if (rest === 0) return t("timers.hours", { count: hours });
      return t("timers.hoursMinutes", { hours, minutes: rest });
    },
    [t],
  );

  const timers = useCookingTimers({
    onEnded: (timer) => {
      sound();
      vibrate();
      notify(
        t("timers.notificationTitle"),
        t("timers.notificationBody", {
          recipe: title,
          number: timer.stepIndex + 1,
          duration: formatDuration(timer.minutes),
        }),
        `fuelr-timer-${timer.id}`,
      );
      // Said out loud too: a chip turning mint is not an announcement.
      setAnnouncement(t("timers.announce", { number: timer.stepIndex + 1 }));
    },
    initial: mine?.timers,
  });

  const ended = timers.timers.filter((timer) => timer.state === "ended");

  // "3 min ago" only has to move once a minute, and only while something has
  // already rung — the countdown itself is driven by the hook. It is read
  // again the moment the tab comes back, because a timer that rang while the
  // screen was off is exactly the one whose "ago" must not be stale.
  useEffect(() => {
    if (ended.length === 0) return;
    const refresh = () => setNow(Date.now());
    refresh();
    const interval = window.setInterval(refresh, 15_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [ended.length]);

  /**
   * Written on every change, so an interruption costs nothing. Never while
   * another dish is still in progress and unsettled, and never once this one
   * is finished — a finished session is not one to come back to.
   */
  useEffect(() => {
    if (!restore || conflict || done) return;
    writeSession({
      recipeId: recipe.id,
      title,
      stepIndex: index,
      stepCount: steps.length,
      servings,
      ticked,
      timers: timers.timers.map(({ stepIndex, minutes, endsAt, remaining, state }) => ({
        stepIndex,
        minutes,
        endsAt,
        remaining,
        state,
      })),
      startedAt,
    });
  }, [
    conflict,
    done,
    index,
    recipe.id,
    restore,
    servings,
    startedAt,
    steps.length,
    ticked,
    timers.timers,
    title,
  ]);

  function finish() {
    setElapsed(Date.now() - startedAt);
    setDone(true);
    // Nothing keeps running behind a kitchen that has been put away.
    for (const timer of timers.timers) timers.cancel(timer.id);
    clearSession();
  }

  function cookAgain() {
    setIndex(0);
    setTicked([]);
    setStartedAt(Date.now());
    setDone(false);
  }

  const durations = useMemo(() => durationsIn(steps[index] ?? ""), [steps, index]);

  function startTimer(minutes: number) {
    // Both of these need the tap that started the timer: a page cannot make a
    // sound, nor ask for notifications, outside a gesture.
    armAlarm();
    void askForNotifications();
    timers.start(index, minutes);
  }

  const go = useCallback(
    (delta: -1 | 1) => {
      setIndex((current) =>
        Math.min(steps.length - 1, Math.max(0, current + delta)),
      );
    },
    [steps.length],
  );

  const closeSheet = useCallback(() => {
    setSheet(false);
    opener.current?.focus();
  }, []);

  /**
   * Keyboard, for cooking from a laptop on the counter. Space is left to
   * whatever control has focus — it is that control's own activation key, and
   * stealing it would advance twice.
   */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;

      if (sheet) {
        if (event.key === "Escape") closeSheet();
        return;
      }
      if (target?.closest("input, textarea, select") || target?.isContentEditable) {
        return;
      }
      if (event.key === " " && target?.closest("button, a")) return;

      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        go(1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeSheet, go, sheet]);

  const recipeHref = {
    pathname: "/app/recipes/[id]" as const,
    params: { id: String(recipe.id) },
  };

  if (done) {
    const minutes = Math.floor(elapsed / 60_000);
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-8 bg-bg px-6 text-center">
        <div className="flex flex-col gap-3">
          <span className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
            {t("finished.label")}
          </span>
          <h1 className="font-display text-[32px] leading-[1.1] font-extrabold tracking-[-0.02em] text-text">
            {title}
          </h1>
          {/* What it took, and nothing else. The meal log does not exist yet,
              and a screen that implied it had logged anything would be lying
              — when it does exist it will copy these values, never point at a
              recipe that can still be edited. */}
          <p data-testid="cook-elapsed" className="tnum text-[15px] font-medium text-text-dim">
            {t("finished.elapsed", {
              duration: minutes < 1 ? t("finished.under") : formatDuration(minutes),
            })}
          </p>
        </div>

        <div className="flex w-full max-w-sm flex-col gap-3">
          <Link
            href={recipeHref}
            className={buttonClasses({ variant: "primary", className: "h-14 w-full" })}
          >
            {t("finished.done")}
          </Link>
          <Button variant="secondary" className="h-14" onClick={cookAgain}>
            {t("finished.again")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-bg">
      <header className="flex shrink-0 items-center gap-2 px-2 py-2 sm:px-4">
        <Link
          href={recipeHref}
          aria-label={t("exit")}
          className="grid size-14 shrink-0 place-items-center rounded-full text-[18px] text-text-dim transition-colors duration-[var(--dur-fast)] ease-[var(--ease)] hover:bg-bg-raised-2 hover:text-text focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--mint-ink)]"
        >
          ✕
        </Link>

        <h1 className="min-w-0 flex-1 truncate font-display text-[16px] leading-[1.2] font-extrabold text-text sm:text-[18px]">
          {title}
        </h1>

        <span
          data-testid="cook-progress"
          className="tnum shrink-0 font-mono text-[13px] font-semibold text-text-dim"
        >
          {t("progress", { number: index + 1, total: steps.length })}
        </span>
      </header>

      {/* Progress is mint: lime stays on the single action of the view. */}
      <div aria-hidden className="h-1 w-full shrink-0 bg-bg-raised-2">
        <div
          data-testid="cook-progress-bar"
          className="h-full rounded-r-full bg-mint transition-[width] duration-[var(--dur)] ease-[var(--ease)]"
          style={{ width: `${((index + 1) / steps.length) * 100}%` }}
        />
      </div>

      {/* Only one session is kept, so taking this one over is said out loud
          rather than done quietly. Nothing is stored for this recipe until
          the cook has answered, which is what lets the other dish survive
          somebody opening the wrong recipe. */}
      {conflict && (
        <div className="shrink-0 px-3 pt-2">
          <Banner
            tone="info"
            data-testid="cook-conflict"
            title={t("conflict.title")}
            action={
              <div className="flex flex-wrap gap-2">
                <Link
                  href={{
                    pathname: "/app/recipes/[id]/cook",
                    params: { id: String(conflict.recipeId) },
                  }}
                  className={buttonClasses({ variant: "primary", className: "h-14" })}
                >
                  {t("conflict.resume")}
                </Link>
                <Button
                  variant="secondary"
                  className="h-14"
                  onClick={() => setConflict(null)}
                >
                  {t("conflict.takeOver")}
                </Button>
              </div>
            }
          >
            {t("conflict.body", {
              recipe: conflict.title,
              number: conflict.stepIndex + 1,
              total: conflict.stepCount,
            })}
          </Banner>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6 lg:p-6">
        {/* The step is the only thing on screen, and it scrolls inside its own
            box: a 600-character imported step must not push the controls off
            the bottom of the phone. */}
        <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          <p className="shrink-0 text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
            {t("stepLabel", { number: index + 1 })}
          </p>
          <p
            data-testid="cook-step"
            aria-live="polite"
            className="max-w-[34ch] text-[22px] leading-[1.45] font-medium text-text sm:text-[26px] lg:text-[30px] lg:leading-[1.4]"
          >
            {steps[index]}
          </p>

          {/* Read out of the step's own text, so an imported recipe gets its
              timers without anyone re-typing them. A step stating no duration
              offers nothing at all — no empty control, no zero. */}
          {durations.length > 0 && (
            <div data-testid="cook-durations" className="flex shrink-0 flex-wrap gap-2 pt-2">
              {durations.map((duration, position) => (
                <button
                  key={`${duration.at}-${position}`}
                  type="button"
                  onClick={() => startTimer(duration.minutes)}
                  className={buttonClasses({
                    variant: "secondary",
                    className: "h-14 px-5",
                  })}
                >
                  ⏱ {formatDuration(duration.minutes)}
                </button>
              ))}
            </div>
          )}
        </main>

        <CookingIngredients
          ingredients={recipe.ingredients}
          recipeServings={recipe.servings}
          servings={servings}
          onServings={setServings}
          ticked={ticked}
          onToggle={(id) =>
            setTicked((current) =>
              current.includes(id)
                ? current.filter((x) => x !== id)
                : [...current, id],
            )
          }
          open={sheet}
          onClose={closeSheet}
        />
      </div>

      {/* A scrim, so a tap anywhere outside the sheet closes it — no precise
          gesture, and nothing behind it is reachable by accident. */}
      {sheet && (
        <button
          type="button"
          aria-label={t("ingredients.close")}
          onClick={closeSheet}
          className="fixed inset-0 z-30 bg-[color-mix(in_srgb,var(--bg)_70%,transparent)] lg:hidden"
        />
      )}

      {/* Running timers stay on screen whatever step is showing: a timer
          belongs to the pan, not to the page the cook happens to be on. */}
      {timers.timers.length > 0 && (
        <ul
          data-testid="cook-timers"
          className="flex shrink-0 items-center gap-2 overflow-x-auto border-t border-line px-3 py-2"
        >
          {timers.timers.map((timer) => {
            const number = timer.stepIndex + 1;
            const ago = timer.endedAt
              ? Math.floor((now - timer.endedAt) / 60_000)
              : 0;
            return (
              <li
                key={timer.id}
                data-testid="cook-timer"
                data-state={timer.state}
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded-full border py-1 pr-1 pl-3",
                  timer.state === "ended"
                    ? "border-mint-ink bg-[color-mix(in_srgb,var(--mint)_14%,transparent)]"
                    : "border-line bg-bg-raised",
                )}
              >
                <span className="flex flex-col">
                  <span className="text-[10px] font-bold tracking-[0.02em] text-gray uppercase">
                    {t("timers.step", { number })}
                  </span>
                  <span
                    className={cn(
                      "tnum font-mono text-[15px] font-semibold whitespace-nowrap",
                      timer.state === "ended" ? "text-mint-ink" : "text-text",
                    )}
                  >
                    {timer.state === "ended"
                      ? `${t("timers.done")} · ${
                          ago >= 1 ? t("timers.doneAgo", { count: ago }) : t("timers.justNow")
                        }`
                      : clock(timer.remaining)}
                  </span>
                </span>

                {timer.state !== "ended" && (
                  <IconButton
                    aria-label={
                      timer.state === "running"
                        ? t("timers.pause", { number })
                        : t("timers.resume", { number })
                    }
                    variant="text"
                    className="size-14"
                    onClick={() =>
                      timer.state === "running"
                        ? timers.pause(timer.id)
                        : timers.resume(timer.id)
                    }
                  >
                    {timer.state === "running" ? "⏸" : "▶"}
                  </IconButton>
                )}

                <IconButton
                  aria-label={t("timers.cancel", { number })}
                  variant="text"
                  className="size-14"
                  onClick={() => timers.cancel(timer.id)}
                >
                  ✕
                </IconButton>
              </li>
            );
          })}
        </ul>
      )}

      {/* The alert that always fires, whatever the browser allowed. */}
      {ended.length > 0 && (
        <div className="shrink-0 px-3 pb-2">
          <Banner
            tone="success"
            data-testid="cook-timer-ended"
            title={t("timers.endedTitle", { count: ended.length })}
            action={
              <Button className="h-14" onClick={timers.dismissEnded}>
                {t("timers.dismiss")}
              </Button>
            }
          >
            {ended
              .map((timer) =>
                t("timers.endedBody", {
                  number: timer.stepIndex + 1,
                  duration: formatDuration(timer.minutes),
                }),
              )
              .join(" · ")}
          </Banner>
        </div>
      )}

      {/* Announced, not only shown. */}
      <p
        data-testid="cook-announcement"
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {announcement}
      </p>

      <footer className="flex shrink-0 items-center gap-2 border-t border-line p-3 sm:gap-3 sm:px-4">
        <div className="lg:hidden">
          <button
            ref={opener}
            type="button"
            onClick={() => setSheet(true)}
            className={buttonClasses({
              variant: "secondary",
              className: "h-14 px-5",
            })}
          >
            {t("ingredients.open")}
          </button>
        </div>

        <IconButton
          aria-label={t("previous")}
          variant="secondary"
          className="size-14 text-[18px]"
          disabled={index === 0}
          onClick={() => go(-1)}
        >
          ←
        </IconButton>

        {last ? (
          <Button className="h-14 flex-1" data-testid="cook-finish" onClick={finish}>
            {t("finish")}
          </Button>
        ) : (
          <Button className="h-14 flex-1" onClick={() => go(1)}>
            {t("next")} →
          </Button>
        )}
      </footer>
    </div>
  );
}
