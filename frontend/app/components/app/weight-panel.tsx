"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Banner } from "@ui/banner";
import { Button } from "@ui/button";
import { Card, CardTitle } from "@ui/card";
import { Input } from "@ui/input";
import { formatDay } from "@app/lib/week";
import type { ProfileInput, WeightEntry, WeightView } from "@app/lib/api";
import {
  recordWeight,
  removeWeight,
  saveProfile,
} from "@app/[locale]/(app)/app/account/actions";

/**
 * Below this, a new weigh-in is not worth a new target: the formula moves by
 * about 10 kcal per kilo, and re-asking somebody every 300 g is nagging.
 */
const WORTH_RECOMPUTING_KG = 1;

/**
 * Weigh-ins: a figure and its date, and nothing said about either.
 *
 * A curve of weight is the field where an application most easily starts to
 * judge. This one draws the figures, in one accent, a day without a weigh-in
 * left blank rather than drawn as zero — and stops there. No streak, no
 * verdict, no congratulation; the same rule as the journal's findings.
 *
 * **A weigh-in proposes a new target; it never applies one.** The target is
 * computed from the profile's weight, which is a snapshot somebody confirmed.
 * When the latest weigh-in has drifted from it, the panel offers the
 * recalculation with what it would change, and only a press writes it.
 */
export function WeightPanel({
  weight,
  profile,
  today,
  compact = false,
}: {
  weight: WeightView;
  /** The six figures, when there are any: what a recalculation would rewrite. */
  profile: ProfileInput | null;
  /** Resolved on the server: the browser's idea of "today" may be a day off. */
  today: string;
  /** The journal shows the curve and the form; the account page only the form. */
  compact?: boolean;
}) {
  const t = useTranslations("weight");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [day, setDay] = useState(today);
  const [kg, setKg] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** The last weigh-in removed, kept until the banner is answered. */
  const [removed, setRemoved] = useState<WeightEntry | null>(null);

  function submit() {
    const value = Number(kg.replace(",", "."));
    if (!Number.isFinite(value) || value < 30 || value > 300) {
      setError(t("form.range"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await recordWeight({ weighedOn: day, weightKg: value });
      if (!result.ok) {
        setError(t("form.failed"));
        return;
      }
      setKg("");
      router.refresh();
    });
  }

  function remove(entry: WeightEntry) {
    startTransition(async () => {
      const result = await removeWeight(entry.id);
      if (result.ok) {
        setRemoved(entry);
        router.refresh();
      }
    });
  }

  function undo() {
    if (!removed) return;
    const entry = removed;
    setRemoved(null);
    startTransition(async () => {
      await recordWeight({ weighedOn: entry.weighedOn, weightKg: entry.weightKg });
      router.refresh();
    });
  }

  /** Writes the latest weigh-in into the profile — and only on this press. */
  function recompute() {
    if (!profile || !weight.latest) return;
    const next = { ...profile, weightKg: weight.latest.weightKg };
    startTransition(async () => {
      const result = await saveProfile(next);
      if (result.ok) router.refresh();
    });
  }

  const drift =
    weight.latest && weight.profileWeightKg != null
      ? weight.latest.weightKg - weight.profileWeightKg
      : 0;
  const offerRecompute = profile != null && Math.abs(drift) >= WORTH_RECOMPUTING_KG;

  return (
    <Card as="panel" data-testid="weight-panel" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <CardTitle>{t("title")}</CardTitle>
        {weight.latest && (
          <span data-testid="weight-latest" className="tnum font-mono text-[13px] text-text-dim">
            {t("latest", {
              kg: weight.latest.weightKg,
              date: formatDay(weight.latest.weighedOn, locale, { day: "numeric", month: "short" }),
            })}
          </span>
        )}
      </div>

      {removed && (
        <Banner
          tone="info"
          data-testid="weight-removed"
          action={
            <Button size="sm" variant="secondary" onClick={undo} data-testid="weight-undo">
              {t("undo")}
            </Button>
          }
          onDismiss={() => setRemoved(null)}
        >
          {t("removed")}
        </Banner>
      )}

      {!compact && <WeightCurve entries={weight.entries} />}

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Input
          label={t("form.date")}
          type="date"
          value={day}
          max={today}
          data-testid="weight-date"
          onChange={(event) => setDay(event.target.value)}
          className="w-full sm:w-auto"
        />
        <Input
          label={t("form.kg")}
          type="number"
          inputMode="decimal"
          step="0.1"
          min={30}
          max={300}
          value={kg}
          data-testid="weight-kg"
          onChange={(event) => setKg(event.target.value)}
          status={error ? "error" : "default"}
          hint={error ?? undefined}
          className="w-full sm:w-32"
        />
        <Button type="submit" variant="secondary" loading={pending} disabled={!kg} data-testid="weight-submit">
          {t("form.submit")}
        </Button>
      </form>

      {/* Offered, with what it changes. Never applied on its own. */}
      {offerRecompute && (
        <div
          data-testid="weight-recompute"
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-bg-raised-2 p-4"
        >
          <p className="text-[13px] leading-[1.5] font-semibold text-text-dim">
            {t("recompute.body", {
              latest: weight.latest!.weightKg,
              profile: weight.profileWeightKg!,
            })}
          </p>
          <Button size="sm" variant="secondary" loading={pending} onClick={recompute}>
            {t("recompute.action")}
          </Button>
        </div>
      )}

      {!compact && weight.entries.length > 0 && (
        <ul className="flex flex-col divide-y divide-line" data-testid="weight-entries">
          {[...weight.entries].reverse().map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-3 py-2">
              <span className="text-[13px] font-semibold text-text-dim">
                {formatDay(entry.weighedOn, locale, { weekday: "short", day: "numeric", month: "short" })}
              </span>
              <span className="tnum font-mono text-[15px] font-semibold text-text">
                {t("kg", { kg: entry.weightKg })}
              </span>
              <Button
                variant="quiet"
                size="sm"
                aria-label={t("remove", { date: entry.weighedOn })}
                data-testid={`weight-remove-${entry.id}`}
                onClick={() => remove(entry)}
              >
                {t("removeShort")}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/* Said once, plainly. */}
      <p className="text-[13px] font-medium text-gray">{t("nothingSaid")}</p>
    </Card>
  );
}

/**
 * One series, one accent, and a day nobody weighed left as a gap.
 *
 * A line rather than bars: a weight is a level, not an amount for the day.
 * The vertical scale is the span of the figures plus a margin, not zero to
 * the value — on a zero-based scale every human weight is a flat line.
 */
function WeightCurve({ entries }: { entries: WeightEntry[] }) {
  const t = useTranslations("weight");
  if (entries.length === 0) {
    return (
      <p data-testid="weight-empty" className="text-[15px] font-medium text-text-dim">
        {t("empty")}
      </p>
    );
  }

  const width = 700;
  const height = 120;
  const pad = 8;
  const values = entries.map((entry) => entry.weightKg);
  const low = Math.min(...values) - 1;
  const high = Math.max(...values) + 1;
  const first = Date.parse(entries[0].weighedOn);
  const last = Date.parse(entries[entries.length - 1].weighedOn);
  const span = Math.max(last - first, 1);
  const x = (entry: WeightEntry) =>
    entries.length === 1 ? width / 2 : pad + ((Date.parse(entry.weighedOn) - first) / span) * (width - pad * 2);
  const y = (kg: number) => pad + (1 - (kg - low) / (high - low)) * (height - pad * 2);
  const path = entries.map((entry, at) => `${at === 0 ? "M" : "L"}${x(entry).toFixed(1)},${y(entry.weightKg).toFixed(1)}`).join(" ");

  return (
    <figure className="m-0" data-testid="weight-curve">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-28 w-full"
        role="img"
        aria-label={t("curve", { count: entries.length, low: low + 1, high: high - 1 })}
      >
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        {entries.map((entry) => (
          <circle
            key={entry.id}
            cx={x(entry)}
            cy={y(entry.weightKg)}
            r={4}
            fill="var(--accent)"
            stroke="var(--bg-raised)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </figure>
  );
}
