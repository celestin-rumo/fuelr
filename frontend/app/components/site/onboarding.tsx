"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button, buttonClasses } from "@ui/button";
import { Card } from "@ui/card";
import { Input } from "@ui/input";
import { Spinner } from "@ui/spinner";
import {
  type Activity,
  type Draft,
  type Goal,
  type Sex,
  type Targets,
  isComplete,
  readDraft,
  writeDraft,
} from "@app/lib/onboarding";

/**
 * False on the server and through hydration, true afterwards.
 *
 * The stored draft only exists in the browser, so a component that reads it
 * cannot render the same markup on both sides. Rather than reading storage in
 * an effect and patching the result in — which is both a state update in an
 * effect and a hydration mismatch — the stateful part simply does not mount
 * until hydration is done, and can then seed itself directly from storage.
 */
const noSubscribe = () => () => {};

function useHydrated() {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
}

const GOALS: Goal[] = ["LOSE", "MAINTAIN", "GAIN"];
const SEXES: Sex[] = ["FEMALE", "MALE"];
const ACTIVITIES: Activity[] = ["SEDENTARY", "LIGHT", "MODERATE", "ACTIVE", "VERY_ACTIVE"];

/** Three questions, then the answer. No account asked for until the very end. */
const STEPS = ["goal", "body", "habits", "preview"] as const;
type Step = (typeof STEPS)[number];

export function Onboarding() {
  const t = useTranslations("onboarding");

  if (!useHydrated()) {
    // A placeholder the same height as the first question, so the page does
    // not jump once the flow appears.
    return (
      <div className="mx-auto flex h-64 w-full max-w-2xl items-center gap-3 text-[15px] font-medium text-text-dim">
        <Spinner />
        {t("preview.working")}
      </div>
    );
  }
  return <OnboardingFlow />;
}

function OnboardingFlow() {
  const t = useTranslations("onboarding");

  // Safe to read storage here: this only ever renders in the browser.
  const [draft, setDraft] = useState<Draft>(readDraft);
  const [step, setStep] = useState<Step>("goal");
  const [resumable] = useState(() => readDraft().goal !== undefined);
  const [targets, setTargets] = useState<Targets | null>(null);

  /** Every answer is written as it is given, so closing the tab loses nothing. */
  function update(changes: Draft) {
    const next = { ...draft, ...changes };
    setDraft(next);
    writeDraft(next);
  }

  useEffect(() => {
    if (step !== "preview" || !isComplete(draft)) return;
    let cancelled = false;
    (async () => {
      const response = await fetch("/api/nutrition/target", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!cancelled && response.ok) setTargets((await response.json()) as Targets);
    })();
    return () => {
      cancelled = true;
    };
  }, [step, draft]);

  const bodyReady =
    draft.age !== undefined && draft.sex !== undefined && draft.heightCm !== undefined;
  const habitsReady = draft.weightKg !== undefined && draft.activity !== undefined;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Progress current={STEPS.indexOf(step)} total={STEPS.length} label={t("progress", {
        current: STEPS.indexOf(step) + 1,
        total: STEPS.length,
      })} />

      {resumable && step === "goal" && (
        <p
          data-testid="onboarding-resume"
          className="mt-6 text-[13px] font-semibold text-mint-ink"
        >
          <span aria-hidden>✓ </span>
          {t("resume")}
        </p>
      )}

      {step === "goal" && (
        <Question title={t("goal.title")} hint={t("goal.hint")}>
          <div className="grid gap-3 sm:grid-cols-3">
            {GOALS.map((goal) => (
              <ChoiceCard
                key={goal}
                selected={draft.goal === goal}
                title={t(`goal.options.${goal}.title`)}
                description={t(`goal.options.${goal}.description`)}
                onClick={() => {
                  update({ goal });
                  setStep("body");
                }}
              />
            ))}
          </div>
        </Question>
      )}

      {step === "body" && (
        <Question title={t("body.title")} hint={t("body.hint")}>
          <div className="flex flex-col gap-5">
            <Input
              label={t("body.age")}
              type="number"
              inputMode="numeric"
              value={draft.age ?? ""}
              onChange={(e) =>
                update({ age: numberOrUndefined(e.target.value) })
              }
            />

            <Choices
              legend={t("body.sex")}
              options={SEXES.map((sex) => ({
                value: sex,
                label: t(`body.sexes.${sex}`),
              }))}
              value={draft.sex}
              onChange={(sex) => update({ sex })}
            />

            <Input
              label={t("body.height")}
              type="number"
              inputMode="numeric"
              value={draft.heightCm ?? ""}
              onChange={(e) =>
                update({ heightCm: numberOrUndefined(e.target.value) })
              }
            />
          </div>

          <Navigation
            onBack={() => setStep("goal")}
            onNext={() => setStep("habits")}
            nextDisabled={!bodyReady}
            backLabel={t("back")}
            nextLabel={t("next")}
          />
        </Question>
      )}

      {step === "habits" && (
        <Question title={t("habits.title")} hint={t("habits.hint")}>
          <div className="flex flex-col gap-5">
            <Input
              label={t("habits.weight")}
              type="number"
              inputMode="decimal"
              step="0.1"
              value={draft.weightKg ?? ""}
              onChange={(e) =>
                update({ weightKg: numberOrUndefined(e.target.value) })
              }
            />

            <Choices
              legend={t("habits.activity")}
              stacked
              options={ACTIVITIES.map((activity) => ({
                value: activity,
                label: t(`habits.activities.${activity}`),
              }))}
              value={draft.activity}
              onChange={(activity) => update({ activity })}
            />
          </div>

          <Navigation
            onBack={() => setStep("body")}
            onNext={() => setStep("preview")}
            nextDisabled={!habitsReady}
            backLabel={t("back")}
            nextLabel={t("seeResult")}
          />
        </Question>
      )}

      {step === "preview" && (
        <Question title={t("preview.title")} hint={t("preview.hint")}>
          {targets ? (
            <div data-testid="onboarding-targets" className="flex flex-col gap-6">
              <Card as="panel" className="flex flex-col gap-5">
                <div className="flex items-baseline gap-2">
                  <span className="tnum font-display text-[44px] leading-[1] font-extrabold tracking-[-0.02em] text-text">
                    {targets.kcal}
                  </span>
                  <span className="text-[13px] font-semibold text-text-dim">
                    {t("preview.perDay")}
                  </span>
                </div>

                <dl className="grid grid-cols-3 gap-3">
                  <Macro label={t("preview.protein")} grams={targets.proteinG} />
                  <Macro label={t("preview.carbs")} grams={targets.carbsG} />
                  <Macro label={t("preview.fat")} grams={targets.fatG} />
                </dl>
              </Card>

              <div className="flex flex-col gap-3">
                {/* The answers are already in the browser; creating the account
                    attaches them, it does not ask for them again. */}
                <Link href="/register" className={buttonClasses({ size: "lg" })}>
                  {t("preview.createAccount")}
                </Link>
                <Button variant="text" onClick={() => setStep("habits")}>
                  {t("back")}
                </Button>
              </div>
            </div>
          ) : (
            <p className="flex items-center gap-3 text-[15px] font-medium text-text-dim">
              <Spinner />
              {t("preview.working")}
            </p>
          )}
        </Question>
      )}
    </div>
  );
}

function numberOrUndefined(value: string) {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function Progress({
  current,
  total,
  label,
}: {
  current: number;
  total: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-1 gap-1" aria-hidden>
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={`h-1 flex-1 rounded-full transition-[background-color] duration-[var(--dur)] ease-[var(--ease)] ${
              index <= current ? "bg-mint" : "bg-bg-raised-2"
            }`}
          />
        ))}
      </div>
      <span className="tnum shrink-0 text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
        {label}
      </span>
    </div>
  );
}

function Question({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-[22px] leading-[1.2] font-extrabold tracking-[-0.02em] text-text">
          {title}
        </h2>
        <p className="text-[15px] leading-[1.6] font-medium text-text-dim">{hint}</p>
      </div>
      {children}
    </section>
  );
}

function ChoiceCard({
  title,
  description,
  selected,
  onClick,
}: {
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    // A real button around the card, rather than a div with role="button":
    // the role would announce it correctly and still leave it unreachable
    // from the keyboard.
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className="rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]"
    >
      <Card as="card" interactive selected={selected} className="h-full">
        <span className="block text-[16px] font-bold text-text">{title}</span>
        <span className="mt-1 block text-[13px] leading-[1.5] font-medium text-text-dim">
          {description}
        </span>
      </Card>
    </button>
  );
}

function Choices<T extends string>({
  legend,
  options,
  value,
  onChange,
  stacked = false,
}: {
  legend: string;
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (value: T) => void;
  stacked?: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-[13px] font-semibold text-text-dim">{legend}</legend>
      <div className={stacked ? "flex flex-col gap-2" : "flex flex-wrap gap-2"}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`rounded-full border-[1.5px] px-4 py-2 text-[13px] font-semibold transition-[background-color,border-color,color] duration-[var(--dur-control)] ease-[var(--ease)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)] ${
              value === option.value
                ? "border-accent-ink bg-accent/14 text-text"
                : "border-line bg-bg-raised-2 text-text-dim hover:border-gray"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Macro({ label, grams }: { label: string; grams: number }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
        {label}
      </dt>
      <dd className="tnum font-mono text-[13px] font-semibold text-text">{grams} g</dd>
    </div>
  );
}

function Navigation({
  onBack,
  onNext,
  nextDisabled,
  backLabel,
  nextLabel,
}: {
  onBack: () => void;
  onNext: () => void;
  nextDisabled: boolean;
  backLabel: string;
  nextLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Button variant="text" onClick={onBack}>
        {backLabel}
      </Button>
      <Button onClick={onNext} disabled={nextDisabled}>
        {nextLabel}
      </Button>
    </div>
  );
}
