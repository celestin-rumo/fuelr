"use client";

import { useState, useTransition } from "react";
import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Banner } from "@ui/banner";
import { Button } from "@ui/button";
import { Card, CardTitle } from "@ui/card";
import { Input } from "@ui/input";
import { cn } from "@ui/cn";
import type { LogHistory, LogWeek } from "@app/lib/api";
import { addDays, formatDay } from "@app/lib/week";
import {
  history as loadHistory,
  logMeal,
  removeEntry,
  setTargets,
} from "@app/[locale]/(app)/app/journal/actions";
import { DayBars } from "./day-bars";

/**
 * The food diary.
 *
 * Writing it down and reading it back are free — a diary nobody can read is
 * not a diary. What the paid plan adds is the target beside it, the findings
 * under it, and history further back than the sliding window.
 *
 * Nothing here congratulates or scolds. There is no streak to break, no badge,
 * and no notification: a diary that makes people feel watched stops being
 * written in, and then it measures nothing at all.
 */
export function Journal({
  week,
  weekStart,
  today,
  canOrder,
}: {
  week: LogWeek;
  weekStart: string;
  today: string;
  /** Whether a plan can actually be bought yet. */
  canOrder: boolean;
}) {
  const t = useTranslations("journal");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [past, setPast] = useState<LogHistory | null>(null);
  const [targetKcal, setTargetKcal] = useState(String(week.targets?.kcal ?? ""));
  const [targetProtein, setTargetProtein] = useState(
    String(week.targets?.proteinG ?? ""),
  );

  const days = week.days;

  function add(event: React.FormEvent) {
    event.preventDefault();
    const name = title.trim();
    const energy = Number(kcal);
    if (!name || !Number.isFinite(energy) || energy < 0) {
      setError(t("errors.incomplete"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await logMeal({
        date,
        title: name,
        kcal: energy,
        proteinG: protein.trim() === "" ? undefined : Number(protein),
      });
      if (!result.ok) {
        setError(t("errors.failed"));
        return;
      }
      setTitle("");
      setKcal("");
      setProtein("");
      router.refresh();
    });
  }

  function saveTargets(event: React.FormEvent) {
    event.preventDefault();
    const energy = Number(targetKcal);
    const proteinTarget = Number(targetProtein);
    if (!Number.isFinite(energy) || energy < 500) {
      setError(t("errors.target"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await setTargets({
        kcal: Math.round(energy),
        proteinG: Math.round(Number.isFinite(proteinTarget) ? proteinTarget : 0),
        carbsG: week.targets?.carbsG ?? 0,
        fatG: week.targets?.fatG ?? 0,
      });
      if (!result.ok) {
        setError(t(`errors.${result.reason}`));
        return;
      }
      router.refresh();
    });
  }

  function showHistory() {
    startTransition(async () => {
      const loaded = await loadHistory(addDays(today, -89), today);
      if (loaded) setPast(loaded);
      else setError(t("errors.failed"));
    });
  }

  return (
    <div className={cn("flex flex-col gap-6", pending && "opacity-[0.9]")}>
      {error && (
        <Banner tone="error" data-testid="journal-error" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <WeekLink week={addDays(weekStart, -7)} label={t("previousWeek")}>
          ←
        </WeekLink>
        <h2 data-testid="journal-week" className="font-display text-[15px] font-bold text-text">
          {t("week", {
            date: formatDay(weekStart, locale, { day: "numeric", month: "long" }),
          })}
        </h2>
        <WeekLink week={addDays(weekStart, 7)} label={t("nextWeek")}>
          →
        </WeekLink>
        <div className="flex-1" />
        <span data-testid="logged-days" className="tnum font-mono text-[13px] text-gray">
          {t("loggedDays", { logged: week.loggedDays, days: days.length })}
        </span>
      </div>

      {/* Free, and first: the diary is the product here. */}
      <Card as="panel" data-testid="log-form">
        <CardTitle>{t("add.title")}</CardTitle>
        <p className="mt-2 text-[15px] leading-[1.5] font-medium text-text-dim">
          {t("add.body")}
        </p>
        <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={add}>
          <div className="min-w-[12rem] flex-1">
            <Input
              label={t("add.name")}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="w-28">
            <Input
              label={t("add.kcal")}
              inputMode="numeric"
              value={kcal}
              onChange={(event) => setKcal(event.target.value)}
            />
          </div>
          <div className="w-28">
            <Input
              label={t("add.protein")}
              inputMode="numeric"
              value={protein}
              onChange={(event) => setProtein(event.target.value)}
            />
          </div>
          <div className="w-40">
            <Input
              label={t("add.date")}
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          <Button type="submit" loading={pending}>
            {t("add.submit")}
          </Button>
        </form>
      </Card>

      {week.tracking ? (
        <>
          <Card as="panel" data-testid="charts">
            <CardTitle>{t("charts.title")}</CardTitle>
            <div className="mt-4">
              <DayBars
                days={days}
                value={(day) => day.kcal}
                target={week.targets?.kcal ?? null}
                label={t("charts.energy")}
                unit="kcal"
              />
            </div>
            {/* Three charts rather than three colours in one — see DayBars. */}
            <div className="mt-6 grid gap-6 sm:grid-cols-3">
              <DayBars
                days={days}
                value={(day) => day.proteinG}
                target={week.targets?.proteinG ?? null}
                label={t("charts.protein")}
                unit="g"
                compact
              />
              <DayBars
                days={days}
                value={(day) => day.carbsG}
                target={week.targets?.carbsG ?? null}
                label={t("charts.carbs")}
                unit="g"
                compact
              />
              <DayBars
                days={days}
                value={(day) => day.fatG}
                target={week.targets?.fatG ?? null}
                label={t("charts.fat")}
                unit="g"
                compact
              />
            </div>
          </Card>

          <Card as="panel" data-testid="insights">
            <CardTitle>{t("insights.title")}</CardTitle>
            <ul className="mt-4 flex flex-col gap-4">
              {week.insights.map((insight) => (
                <li key={insight.code} className="border-l-2 border-line pl-3">
                  <p className="text-[15px] leading-[1.5] font-semibold text-text">
                    {t(`insights.${insight.code}.finding`, insight.values)}
                  </p>
                  {/* A finding with nothing to do about it is just a verdict. */}
                  <p className="mt-1 text-[13px] leading-[1.5] font-medium text-text-dim">
                    {t(`insights.${insight.code}.action`, insight.values)}
                  </p>
                </li>
              ))}
            </ul>
          </Card>

          <Card as="panel" data-testid="targets">
            <CardTitle>{t("targets.title")}</CardTitle>
            <p className="mt-2 text-[15px] leading-[1.5] font-medium text-text-dim">
              {week.targets?.chosen ? t("targets.chosen") : t("targets.computed")}
            </p>
            <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={saveTargets}>
              <div className="w-32">
                <Input
                  label={t("targets.kcal")}
                  inputMode="numeric"
                  value={targetKcal}
                  onChange={(event) => setTargetKcal(event.target.value)}
                />
              </div>
              <div className="w-32">
                <Input
                  label={t("targets.protein")}
                  inputMode="numeric"
                  value={targetProtein}
                  onChange={(event) => setTargetProtein(event.target.value)}
                />
              </div>
              <Button type="submit" variant="secondary" loading={pending}>
                {t("targets.submit")}
              </Button>
            </form>
          </Card>
        </>
      ) : (
        <Card as="panel" data-testid="tracking-locked">
          <CardTitle>{t("locked.title")}</CardTitle>
          <p className="mt-2 text-[15px] leading-[1.5] font-medium text-text-dim">
            {t("locked.body")}
          </p>
          <p className="mt-4 text-[13px] font-semibold text-text-dim">
            {canOrder ? t("locked.order") : t("locked.notPurchasable")}
          </p>
          <div className="mt-4">
            <Link
              href="/app/household"
              className="text-[13px] font-semibold text-mint-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]"
            >
              {t("locked.link")}
            </Link>
          </div>
        </Card>
      )}

      <section data-testid="entries">
        <h2 className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
          {t("entries.title")}
        </h2>
        {week.entries.length === 0 ? (
          <p className="mt-2 text-[15px] font-medium text-text-dim">{t("entries.empty")}</p>
        ) : (
          <ul className="mt-2 flex flex-col divide-y divide-line rounded-md border border-line bg-bg-raised">
            {week.entries.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-3 p-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-text">
                    {entry.title}
                  </span>
                  <span className="tnum block font-mono text-[13px] text-gray">
                    {formatDay(entry.date, locale, { weekday: "short", day: "numeric" })}
                    {" · "}
                    {t("entries.figures", {
                      kcal: entry.kcal,
                      protein: entry.proteinG,
                    })}
                    {entry.estimated && (
                      // Grey, not coral: a figure somebody typed is an
                      // estimate, which is a fact about it and not an alarm.
                      <span className="ml-2 text-gray">{t("estimated")}</span>
                    )}
                  </span>
                </span>
                <Button
                  variant="dangerText"
                  size="sm"
                  aria-label={t("entries.remove", { title: entry.title })}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await removeEntry(entry.id);
                      if (result.ok) router.refresh();
                    })
                  }
                >
                  ✕
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Card as="panel" data-testid="history">
        <CardTitle>{t("history.title")}</CardTitle>
        {past ? (
          <div className="mt-4 flex flex-col gap-3">
            {past.windowed && (
              // Not an error and not a wall: the answer is smaller, and the
              // rows outside it are still there for the day the plan changes.
              <Banner tone="info" data-testid="history-windowed">
                {t("history.windowed", { days: past.windowDays })}
              </Banner>
            )}
            <DayBars
              days={past.days}
              value={(day) => day.kcal}
              target={week.targets?.kcal ?? null}
              label={t("history.energy")}
              unit="kcal"
              compact
            />
            <p className="tnum font-mono text-[13px] text-gray">
              {t("history.range", {
                from: formatDay(past.from, locale, { day: "numeric", month: "short" }),
                to: formatDay(past.to, locale, { day: "numeric", month: "short" }),
              })}
            </p>
          </div>
        ) : (
          <div className="mt-4">
            <Button variant="secondary" onClick={showHistory} loading={pending}>
              {t("history.load")}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

function WeekLink({
  week,
  label,
  children,
}: {
  week: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={{ pathname: "/app/journal", query: { week } }}
      aria-label={label}
      className="grid size-9 place-items-center rounded-full border border-line text-text-dim hover:border-gray hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]"
    >
      {children}
    </Link>
  );
}
