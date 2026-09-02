import { useCallback, useEffect, useRef, useState } from "react";

export type CookingTimer = {
  id: string;
  /** Which step offered it, so a running timer says what it belongs to. */
  stepIndex: number;
  minutes: number;
  /** Epoch ms it is due. Null while paused. */
  endsAt: number | null;
  /** Seconds left — the source of truth while paused. */
  remaining: number;
  state: "running" | "paused" | "ended";
  /** Epoch ms it actually rang, so "3 min ago" is honest after a return. */
  endedAt?: number;
};

type Options = {
  /** Rings: a sound, a vibration, a notification. Called once per timer. */
  onEnded: (timer: CookingTimer) => void;
};

let counter = 0;

/**
 * Kitchen timers that survive the screen going away.
 *
 * Every timer stores the wall-clock instant it is due, and the remaining time
 * is recomputed from `Date.now()` rather than counted down. An interval alone
 * is throttled to a crawl in a hidden tab, so a counted-down timer comes back
 * wrong by exactly the minutes the cook was away — which is the only moment it
 * ever mattered.
 *
 * Three things drive it, and they are not redundant: an interval keeps the
 * display honest while the page is visible, a per-timer timeout rings at the
 * right instant, and `visibilitychange` re-reads the clock the moment the tab
 * comes back. A backgrounded tab can still have its timeout throttled by the
 * browser, so a notification may land up to a minute late; nothing a page can
 * do changes that, and coming back to the app always shows the truth.
 */
export function useCookingTimers({ onEnded }: Options) {
  const [timers, setTimers] = useState<CookingTimer[]>([]);
  // A mirror, because the tick reads the current timers from outside React's
  // render cycle and must not ring twice for one timer.
  const current = useRef<CookingTimer[]>([]);
  const alarms = useRef(new Map<string, number>());
  // Held in a ref so the tick never has to be rebuilt when the caller passes a
  // fresh closure, which it does on every render.
  const ring = useRef(onEnded);
  useEffect(() => {
    ring.current = onEnded;
  }, [onEnded]);

  const commit = useCallback((next: CookingTimer[]) => {
    current.current = next;
    setTimers(next);
  }, []);

  const tick = useCallback(() => {
    if (current.current.length === 0) return;
    const now = Date.now();
    const rang: CookingTimer[] = [];

    const next = current.current.map((timer) => {
      if (timer.state !== "running" || timer.endsAt === null) return timer;
      const remaining = (timer.endsAt - now) / 1000;
      if (remaining > 0) return { ...timer, remaining };
      const done: CookingTimer = {
        ...timer,
        remaining: 0,
        state: "ended",
        endedAt: timer.endsAt,
      };
      rang.push(done);
      return done;
    });

    // Nothing running means nothing moved, and committing anyway would leave
    // the screen re-rendering twice a second for as long as a rung timer sits
    // there waiting to be dismissed.
    if (!next.some((timer, i) => timer !== current.current[i])) return;

    commit(next);
    for (const timer of rang) {
      alarms.current.delete(timer.id);
      ring.current(timer);
    }
  }, [commit]);

  useEffect(() => {
    const interval = window.setInterval(tick, 500);
    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [tick]);

  const schedule = useCallback(
    (id: string, seconds: number) => {
      const existing = alarms.current.get(id);
      if (existing) window.clearTimeout(existing);
      alarms.current.set(
        id,
        window.setTimeout(tick, Math.max(0, seconds * 1000)),
      );
    },
    [tick],
  );

  const clearAlarm = useCallback((id: string) => {
    const existing = alarms.current.get(id);
    if (existing) window.clearTimeout(existing);
    alarms.current.delete(id);
  }, []);

  // Leaving cooking mode stops every timer: nothing keeps ticking behind a
  // screen the cook has left.
  useEffect(() => {
    const pending = alarms.current;
    return () => {
      for (const handle of pending.values()) window.clearTimeout(handle);
      pending.clear();
    };
  }, []);

  const start = useCallback(
    (stepIndex: number, minutes: number) => {
      counter += 1;
      const id = `t${counter}`;
      const seconds = minutes * 60;
      commit([
        ...current.current,
        {
          id,
          stepIndex,
          minutes,
          endsAt: Date.now() + seconds * 1000,
          remaining: seconds,
          state: "running",
        },
      ]);
      schedule(id, seconds);
    },
    [commit, schedule],
  );

  const pause = useCallback(
    (id: string) => {
      clearAlarm(id);
      commit(
        current.current.map((timer) =>
          timer.id === id && timer.state === "running"
            ? { ...timer, state: "paused", endsAt: null }
            : timer,
        ),
      );
    },
    [clearAlarm, commit],
  );

  const resume = useCallback(
    (id: string) => {
      commit(
        current.current.map((timer) => {
          if (timer.id !== id || timer.state !== "paused") return timer;
          schedule(id, timer.remaining);
          return {
            ...timer,
            state: "running",
            endsAt: Date.now() + timer.remaining * 1000,
          };
        }),
      );
    },
    [commit, schedule],
  );

  const cancel = useCallback(
    (id: string) => {
      clearAlarm(id);
      commit(current.current.filter((timer) => timer.id !== id));
    },
    [clearAlarm, commit],
  );

  /** Clears every timer that has already rung, and only those. */
  const dismissEnded = useCallback(() => {
    commit(current.current.filter((timer) => timer.state !== "ended"));
  }, [commit]);

  return { timers, start, pause, resume, cancel, dismissEnded };
}
