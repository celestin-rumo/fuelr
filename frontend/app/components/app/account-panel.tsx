"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Banner } from "@ui/banner";
import { Button } from "@ui/button";
import { Card } from "@ui/card";
import { Input } from "@ui/input";
import { Segmented } from "@ui/segmented";
import { SectionHead } from "@ui/section-head";
import { Tab, TabList } from "@ui/tabs";
import { PasswordStrength } from "./password-strength";
import { ChoiceCard, Choices } from "@app/components/site/onboarding";
import type { Session } from "@app/lib/session";
import type { ProfileInput, ProfileResponse, ProfileTargets } from "@app/lib/api";
import {
  changePassword,
  recordWeight,
  requestEmailChange,
  saveProfile,
  updateAccount,
} from "@app/[locale]/(app)/app/account/actions";

const LOCALES = ["fr", "en", "de"] as const;
const SEXES = ["FEMALE", "MALE"] as const;
const ACTIVITIES = ["SEDENTARY", "LIGHT", "MODERATE", "ACTIVE", "VERY_ACTIVE"] as const;
const GOALS = ["LOSE", "MAINTAIN", "GAIN"] as const;

type Notice = { tone: "success" | "error"; text: string } | null;

/**
 * Four forms on one page, each its own transaction.
 *
 * They are separate on purpose: a name is saved on blur, a password wants its
 * old one, an address wants a password *and* a click in a mail, and the six
 * figures of the profile are previewed before they are written. One big form
 * with one save button would have to explain four different failures with
 * one message.
 *
 * Two things are never pre-filled: the passwords. A password field that
 * arrives full is a password somebody can read off the screen.
 */
export type AccountSection = "you" | "language" | "email" | "password" | "goals";

export function AccountPanel({
  session,
  profile,
  sections = ["you", "goals", "email", "language", "password"],
  headed = sections.length > 1,
  today,
}: {
  session: Session;
  profile: ProfileResponse | null;
  /** Which of the four forms this instance shows: a tab shows only its own. */
  sections?: AccountSection[];
  /** Whether each section carries its heading; a lone section in a fold does not. */
  headed?: boolean;
  /** Today, resolved on the server: the day a weight typed here is weighed on. */
  today?: string;
}) {
  const show = (section: AccountSection) => sections.includes(section);
  const t = useTranslations("account");
  const tOnboarding = useTranslations("onboarding");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<Notice>(null);

  // --- identity ---------------------------------------------------------------
  const [name, setName] = useState(session.name ?? "");

  function saveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === session.name) return;
    startTransition(async () => {
      const result = await updateAccount({ name: trimmed });
      setNotice(result.ok
        ? { tone: "success", text: t("profile.saved") }
        : { tone: "error", text: t("failed") });
      if (result.ok) router.refresh();
    });
  }

  /**
   * The language follows the account, and the page follows the language:
   * saving it lands on the same page in the new locale, which is the only
   * honest confirmation there is.
   */
  function saveLocale(next: string) {
    startTransition(async () => {
      const result = await updateAccount({ locale: next });
      if (!result.ok) {
        setNotice({ tone: "error", text: t("failed") });
        return;
      }
      router.replace("/app/account/profile", { locale: next as (typeof LOCALES)[number] });
    });
  }

  // --- email -----------------------------------------------------------------------
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  function askEmailChange() {
    setEmailError(null);
    startTransition(async () => {
      const result = await requestEmailChange({
        email: newEmail.trim(),
        password: emailPassword,
        locale,
      });
      if (result.ok) {
        setEmailSent(true);
        setEmailPassword("");
      } else {
        setEmailError(t(result.reason === "wrong" ? "email.wrongPassword" : "failed"));
      }
    });
  }

  // --- password ---------------------------------------------------------------------
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  function submitPassword() {
    setPasswordError(null);
    if (next.length < 8) {
      setPasswordError(t("password.tooShort"));
      return;
    }
    startTransition(async () => {
      const result = await changePassword({ current, next, locale });
      if (result.ok) {
        setCurrent("");
        setNext("");
        setNotice({ tone: "success", text: t("password.changed") });
      } else {
        setPasswordError(t(result.reason === "wrong" ? "password.wrong" : "failed"));
      }
    });
  }

  // --- the six figures ------------------------------------------------------------------
  const [figures, setFigures] = useState<Partial<ProfileInput>>(profile?.profile ?? {});
  /** Two questions, one at a time: a goal is chosen, an activity is admitted. */
  const [goalsTab, setGoalsTab] = useState<"goal" | "activity">("goal");
  const [preview, setPreview] = useState<ProfileTargets | null>(profile?.targets ?? null);
  /** The weight last written, so a weigh-in is recorded once per change, not per blur. */
  const [savedWeight, setSavedWeight] = useState(profile?.profile.weightKg);

  function complete(input: Partial<ProfileInput>): input is ProfileInput {
    return (
      input.birthDate != null && input.sex != null && input.heightCm != null &&
      input.weightKg != null && input.activity != null && input.goal != null
    );
  }

  /** A keystroke: the figure changes on screen and nowhere else yet. */
  function edit(patch: Partial<ProfileInput>) {
    setFigures((current) => ({ ...current, ...patch }));
  }

  /**
   * A figure is written the moment it is settled — a field left, a card
   * pressed — and the target follows it. No save button: a button under six
   * fields that each mean one thing is a second decision nobody asked for,
   * and the name beside them has always saved on its own. Nothing is written
   * while a figure is still missing, because the formula has nothing to say.
   */
  function commit(next: Partial<ProfileInput> = figures) {
    if (!complete(next)) return;
    if (JSON.stringify(next) === JSON.stringify(profile?.profile) && next.weightKg === savedWeight) {
      return;
    }
    startTransition(async () => {
      // The weight is the one figure with a history. Typed here, it is
      // today's weigh-in, and the profile follows it the way it follows the
      // journal's — one fact, written once.
      if (today && next.weightKg !== savedWeight) {
        const weighIn = await recordWeight({ weighedOn: today, weightKg: next.weightKg });
        if (!weighIn.ok) {
          setNotice({ tone: "error", text: t("failed") });
          return;
        }
        setSavedWeight(next.weightKg);
      }
      const result = await saveProfile(next);
      if (result.ok) {
        setPreview(result.saved.targets);
        setNotice({ tone: "success", text: t("figures.saved") });
        router.refresh();
      } else {
        setNotice({ tone: "error", text: t("failed") });
      }
    });
  }

  /** A choice is settled by being made. */
  function choose(patch: Partial<ProfileInput>) {
    const next = { ...figures, ...patch };
    setFigures(next);
    commit(next);
  }

  const number = (value: string) => (value === "" ? undefined : Number(value));

  return (
    <div className="flex flex-col gap-8" data-testid="account-panel">
      {notice && (
        <Banner
          tone={notice.tone}
          onDismiss={() => setNotice(null)}
          data-testid="account-notice"
        >
          {notice.text}
        </Banner>
      )}

      {/* --- who: what is true of the person, in one card -------------------- */}
      {show("you") && (
      <section className="flex flex-col gap-4" data-testid="you-section">
        {headed && (
          <SectionHead as="h2" hint={t("you.hint")}>
            {t("you.title")}
          </SectionHead>
        )}
        <Card as="panel" className="flex flex-col gap-5">
          <Input
            label={t("profile.name")}
            value={name}
            data-testid="account-name"
            onChange={(event) => setName(event.target.value)}
            onBlur={saveName}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                saveName();
              }
            }}
          />

          {!profile && (
            <p className="text-[15px] leading-[1.5] font-medium text-text-dim">
              {t("figures.none")}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t("body.birthDate")}
              type="date"
              max={today ?? new Date().toISOString().slice(0, 10)}
              value={figures.birthDate ?? ""}
              data-testid="figure-birth"
              onChange={(event) => edit({ birthDate: event.target.value || undefined })}
              onBlur={() => commit()}
            />
            <Input
              label={tOnboarding("body.height")}
              type="number"
              inputMode="numeric"
              value={figures.heightCm ?? ""}
              data-testid="figure-height"
              onChange={(event) => edit({ heightCm: number(event.target.value) })}
              onBlur={() => commit()}
            />
            {/* A weight typed here is today's weigh-in — the one place to say
                it, and the journal's history is the same row. */}
            <Input
              label={t("body.weight")}
              hint={t("body.weightHint")}
              type="number"
              inputMode="decimal"
              step="0.1"
              value={figures.weightKg ?? ""}
              data-testid="figure-weight"
              onChange={(event) => edit({ weightKg: number(event.target.value) })}
              onBlur={() => commit()}
            />
          </div>
          <Choices
            legend={tOnboarding("body.sex")}
            options={SEXES.map((sex) => ({ value: sex, label: tOnboarding(`body.sexes.${sex}`) }))}
            value={figures.sex}
            onChange={(sex) => choose({ sex })}
          />
        </Card>
      </section>
      )}

      {/* --- the language, which hardly ever changes ------------------------- */}
      {show("language") && (
      <section className="flex flex-col gap-4" data-testid="language-section">
        {headed && (
          <SectionHead as="h2" hint={t("language.hint")}>
            {t("language.title")}
          </SectionHead>
        )}
        <Card as="panel" className="flex flex-col gap-2">
          <Segmented
            label={t("profile.language")}
            value={(session.locale ?? locale) as (typeof LOCALES)[number]}
            onChange={saveLocale}
            options={LOCALES.map((code) => ({ value: code, label: t(`profile.locales.${code}`) }))}
          />
          <p className="text-[13px] font-medium text-gray">{t("profile.languageHint")}</p>
        </Card>
      </section>
      )}

      {/* --- the address ----------------------------------------------------- */}
      {show("email") && (
      <section className="flex flex-col gap-4">
        <SectionHead as="h2" hint={t("email.hint")}>
          {t("email.title")}
        </SectionHead>
        <Card as="panel" className="flex flex-col gap-5">
          <p className="text-[15px] font-medium text-text">
            <span className="text-text-dim">{t("email.current")}</span>{" "}
            <span data-testid="account-email" className="font-semibold">
              {session.email}
            </span>
          </p>

          {emailSent ? (
            <p role="status" data-testid="email-change-sent" className="text-[15px] leading-[1.5] font-medium text-mint-ink">
              {t("email.sent", { email: newEmail.trim() })}
            </p>
          ) : (
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                askEmailChange();
              }}
            >
              <Input
                label={t("email.new")}
                type="email"
                autoComplete="email"
                value={newEmail}
                data-testid="email-new"
                onChange={(event) => setNewEmail(event.target.value)}
              />
              <Input
                label={t("email.password")}
                type="password"
                autoComplete="current-password"
                value={emailPassword}
                data-testid="email-password"
                onChange={(event) => setEmailPassword(event.target.value)}
                status={emailError ? "error" : "default"}
                hint={emailError ?? undefined}
              />
              <div>
                <Button
                  type="submit"
                  variant="secondary"
                  loading={pending}
                  disabled={!newEmail.trim() || !emailPassword}
                  data-testid="email-submit"
                >
                  {t("email.submit")}
                </Button>
              </div>
            </form>
          )}
        </Card>
      </section>
      )}

      {/* --- the password ------------------------------------------------------ */}
      {show("password") && (
      <section className="flex flex-col gap-4">
        {headed && (
          <SectionHead as="h2" hint={t("password.hint")}>
            {t("password.title")}
          </SectionHead>
        )}
        <Card as="panel">
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              submitPassword();
            }}
          >
            <Input
              label={t("password.current")}
              type="password"
              autoComplete="current-password"
              value={current}
              data-testid="password-current"
              onChange={(event) => setCurrent(event.target.value)}
            />
            <Input
              label={t("password.next")}
              type="password"
              autoComplete="new-password"
              value={next}
              data-testid="password-next"
              onChange={(event) => setNext(event.target.value)}
              status={passwordError ? "error" : "default"}
              hint={passwordError ?? undefined}
            />
            <PasswordStrength password={next} />
            <div>
              <Button
                type="submit"
                variant="secondary"
                loading={pending}
                disabled={!current || !next}
                data-testid="password-submit"
              >
                {t("password.submit")}
              </Button>
            </div>
          </form>
        </Card>
      </section>
      )}

      {/* --- what changes: activity and goal ----------------------------------- */}
      {show("goals") && (
      <section className="flex flex-col gap-4" data-testid="goals-section">
        {headed && (
          <SectionHead as="h2" hint={t("goals.hint")}>
            {t("goals.title")}
          </SectionHead>
        )}
        <Card as="panel" className="flex flex-col gap-5">
          <TabList>
            <Tab
              id="goals-tab-goal"
              aria-controls="goals-panel-goal"
              className="min-h-11"
              active={goalsTab === "goal"}
              onClick={() => setGoalsTab("goal")}
              data-testid="goals-tab-goal"
            >
              {tOnboarding("goal.title")}
            </Tab>
            <Tab
              id="goals-tab-activity"
              aria-controls="goals-panel-activity"
              className="min-h-11"
              active={goalsTab === "activity"}
              onClick={() => setGoalsTab("activity")}
              data-testid="goals-tab-activity"
            >
              {tOnboarding("habits.activity")}
            </Tab>
          </TabList>

          {/* Three small cards, like the onboarding: one block of three stacked
              rows read as one big thing when nothing was chosen yet. */}
          {goalsTab === "goal" && (
            <div
              role="tabpanel"
              id="goals-panel-goal"
              aria-labelledby="goals-tab-goal"
              className="grid gap-3 sm:grid-cols-3"
              data-testid="goal-cards"
            >
              {GOALS.map((goal) => (
                <ChoiceCard
                  key={goal}
                  selected={figures.goal === goal}
                  title={tOnboarding(`goal.options.${goal}.title`)}
                  description={tOnboarding(`goal.options.${goal}.description`)}
                  onClick={() => choose({ goal })}
                />
              ))}
            </div>
          )}

          {goalsTab === "activity" && (
            <div
              role="tabpanel"
              id="goals-panel-activity"
              aria-labelledby="goals-tab-activity"
              className="flex flex-col gap-2"
              data-testid="activity-panel"
            >
              <Segmented
                label={tOnboarding("habits.activity")}
                className="max-sm:w-full max-sm:flex-col"
                value={figures.activity}
                onChange={(activity) => choose({ activity })}
                options={ACTIVITIES.map((activity) => ({
                  value: activity,
                  label: t(`goals.activityShort.${activity}`),
                }))}
              />
              {figures.activity && (
                <p className="text-[13px] font-medium text-gray">
                  {tOnboarding(`habits.activities.${figures.activity}`)}
                </p>
              )}
            </div>
          )}

          {preview && (
            <dl
              data-testid="target-preview"
              className="tnum grid grid-cols-2 gap-3 rounded-md border border-line bg-bg-raised-2 p-4 sm:grid-cols-4"
            >
              {(["kcal", "proteinG", "carbsG", "fatG"] as const).map((key) => (
                <div key={key} className="flex flex-col gap-1">
                  <dt className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
                    {t(`figures.targets.${key}`)}
                  </dt>
                  <dd className="font-mono text-[15px] font-semibold text-text">
                    {preview[key]}
                    {key === "kcal" ? "" : " g"}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <p className="text-[13px] font-medium text-gray">{t("figures.formula")}</p>
        </Card>
      </section>
      )}

    </div>
  );
}
