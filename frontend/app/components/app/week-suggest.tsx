"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Button, buttonClasses } from "@ui/button";
import { Badge } from "@ui/badge";
import { Chip } from "@ui/chip";
import { Dialog } from "@ui/dialog";
import { Input } from "@ui/input";
import { Icon } from "@ui/icons";
import { cn } from "@ui/cn";
import { CUISINES } from "@app/lib/cuisines";
import { SLOTS, formatDay } from "@app/lib/week";
import type { Slot } from "@app/lib/week";
import type { Declined, WeekProposal, WeekSuggestion } from "@app/lib/api";
import { askLive } from "@app/lib/ideas-stream";
import type { Progress } from "@app/lib/ideas-stream";
import { acceptProposal } from "@app/[locale]/(app)/app/plan/actions";
import { WorkingOn } from "./working-on";
import { IdeaThumb } from "./recipe-thumb";

/**
 * The intentions somebody can ask a week for.
 *
 * The library's own tags, minus the two that describe a recipe rather than a
 * wish: `batch` belongs to the batch-cooking story, and `glutenFree` is a
 * constraint somebody has rather than a direction they pick on a Tuesday. What
 * is left is the four things people actually say out loud.
 */
const INTENTS = ["vegetarian", "protein", "quick", "cheap"] as const;

/**
 * Why somebody turned a dish down, from a list rather than a text field.
 *
 * A closed list is what lets a refusal *do* something: `TOO_LONG` adds "quick"
 * to the next round, and the screen says so. The rest are honest exclusions —
 * pretending to act on "pas envie" would be inventing a rule nobody asked for.
 * The free-text note beside them is for what a list cannot hold, and it only
 * ever reaches a model.
 */
const REASONS = ["notTonight", "tooLong", "tooOften", "missingIngredients"] as const;

type Reason = (typeof REASONS)[number];

/** How many times the same week may be re-asked. */
const MOST_ROUNDS = 4;

type Stage = "asking" | "reviewing" | "done";

/** A proposal plus what somebody decided about it. */
type Decision = { proposal: WeekProposal; refused: Reason | null };

export function WeekSuggest({
  weekStart,
  /** `date:slot` for every slot that already holds a meal. */
  planned,
}: {
  weekStart: string;
  planned: string[];
}) {
  const t = useTranslations("plan.suggest");
  const tTags = useTranslations("recipe.tags");
  const tCuisines = useTranslations("recipe.cuisines");
  const tSlots = useTranslations("plan.slots");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("asking");
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  // The ask is not a transition: what the stream says has to render the
  // moment it arrives, and a transition holds its updates until it ends.
  const [asking, setAsking] = useState(false);

  const [intents, setIntents] = useState<string[]>([]);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [slots, setSlots] = useState<Slot[]>(["DINNER"]);
  const [note, setNote] = useState("");

  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [round, setRound] = useState(0);
  const [declined, setDeclined] = useState<Declined>("NONE");
  const [unfilled, setUnfilled] = useState(0);
  const [added, setAdded] = useState(0);

  const kept = decisions.filter((one) => one.refused === null);
  const refused = decisions.filter((one) => one.refused !== null);
  const roundsLeft = MOST_ROUNDS - round;

  function reset() {
    setStage("asking");
    setDecisions([]);
    setRound(0);
    setAdded(0);
    setUnfilled(0);
    setDeclined("NONE");
    setFailed(false);
    setNote("");
  }

  function toggle(list: string[], value: string, set: (next: string[]) => void) {
    set(list.includes(value) ? list.filter((one) => one !== value) : [...list, value]);
  }

  /**
   * Asks for the slots that are still open.
   *
   * Everything already decided travels as `keep` — the meals on the plan, and
   * the proposals somebody chose to keep from the last round — so what comes
   * back replaces exactly what was turned down and nothing else. What was
   * refused travels by name, because every dish here is one nobody has
   * written yet and an idea has no id.
   */
  function ask(keeping: Decision[], refusing: Decision[]) {
    // A refusal the app can act on, rather than one it only records. "Trop
    // long" is the only one of the four that names something the library can
    // search on, so it is the only one that changes the ask — and the chip
    // lighting up on the way back is what says so.
    const narrowed = refusing.some((one) => one.refused === "tooLong")
      ? Array.from(new Set([...intents, "quick"]))
      : intents;
    setIntents(narrowed);
    const asked = narrowed;

    setFailed(false);
    setProgress(null);
    setAsking(true);
    void (async () => {
      const result = await askLive<WeekSuggestion>("/api/plan/suggest", {
        week: weekStart,
        intents: asked,
        cuisines,
        slots,
        keep: [
          ...planned.map((key) => {
            const [date, slot] = key.split(":");
            return { date, slot: slot as Slot };
          }),
          ...keeping.map((one) => ({
            date: one.proposal.date,
            slot: one.proposal.slot,
          })),
        ],
        excludeTitles: [...keeping, ...refusing].map((one) => one.proposal.title),
        note: note.trim(),
      }, setProgress);
      setAsking(false);

      if (!result.ok) {
        setFailed(true);
        return;
      }
      setDecisions([
        ...keeping,
        ...result.result.proposals.map((proposal) => ({ proposal, refused: null })),
      ]);
      setDeclined(result.result.declined);
      setUnfilled(result.result.unfilled);
      setRound((current) => current + 1);
      setStage("reviewing");
    })();
  }

  /** Writes what is left onto the week, one meal at a time. */
  function accept() {
    startTransition(async () => {
      let written = 0;
      for (const one of kept) {
        const result = await acceptProposal(one.proposal);
        if (result.ok) written += 1;
      }
      setAdded(written);
      setStage("done");
      router.refresh();
    });
  }

  const dayOf = (date: string) => formatDay(date, locale, { weekday: "short" });

  return (
    <>
      <Button
        variant="secondary"
        data-testid="suggest-week"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        {t("action")}
      </Button>

      {open && (
        <Dialog
          title={t(`${stage}.title`)}
          closeLabel={t("close")}
          data-testid="suggest-dialog"
          onClose={() => setOpen(false)}
        >
          {stage === "asking" && asking && (
            <WorkingOn
              className="mt-3"
              data-testid="working"
              label={t("working")}
              words={[...intents, ...cuisines].join(" ")}
              progress={progress}
            />
          )}

          {stage === "asking" && !asking && (
            <div className="mt-3 flex flex-col gap-6">
              <p className="text-[15px] leading-[1.5] font-medium text-text-dim">
                {t("asking.body")}
              </p>

              <Choices
                label={t("asking.intents")}
                hint={t("asking.intentsHint")}
                values={INTENTS as readonly string[]}
                selected={intents}
                nameOf={(value) => tTags(value)}
                onToggle={(value) => toggle(intents, value, setIntents)}
              />

              <Choices
                label={t("asking.cuisines")}
                hint={t("asking.cuisinesHint")}
                values={CUISINES}
                selected={cuisines}
                nameOf={(value) => tCuisines(value)}
                onToggle={(value) => toggle(cuisines, value, setCuisines)}
              />

              <Choices
                label={t("asking.slots")}
                hint={t("asking.slotsHint")}
                values={SLOTS}
                selected={slots}
                nameOf={(value) => tSlots(value)}
                onToggle={(value) => {
                  const slot = value as Slot;
                  // At least one, or there is nothing to fill.
                  const next = slots.includes(slot)
                    ? slots.filter((one) => one !== slot)
                    : [...slots, slot];
                  if (next.length > 0) setSlots(next);
                }}
              />

              {failed && (
                <p role="status" className="text-[13px] font-semibold text-coral-ink">
                  {t("failed")}
                </p>
              )}

              <div className="flex flex-wrap gap-3">
                <Button onClick={() => ask([], [])} loading={asking}>
                  {t("asking.submit")}
                </Button>
                <Button variant="secondary" onClick={() => setOpen(false)}>
                  {t("cancel")}
                </Button>
              </div>
            </div>
          )}

          {stage === "reviewing" && (
            <div className="mt-3 flex flex-col gap-5">
              {/* Asking again writes only what was turned down; the count
                  is of those, and the kept dishes stay on show below. */}
              {asking && refused.length > 0 && (
                <WorkingOn
                  data-testid="working"
                  label={t("working")}
                  words={refused.map((one) => one.proposal.title).join(" ")}
                  progress={progress}
                />
              )}

              <p className="text-[15px] leading-[1.5] font-medium text-text-dim">
                {t("reviewing.body", { count: kept.length })}
              </p>

              {/* There is no second source, so a refusal is named rather
                  than turned into fewer proposals nobody can account for. */}
              {declined !== "NONE" && (
                <p
                  role="status"
                  data-testid="declined"
                  className="text-[13px] font-semibold text-coral-ink"
                >
                  {t(`declined.${declined}`)}
                </p>
              )}

              {/* Nothing found for some slots is an answer, not a failure. */}
              {unfilled > 0 && (
                <p className="text-[13px] font-semibold text-text-dim">
                  {t("reviewing.unfilled", { count: unfilled })}
                </p>
              )}

              <ul className="flex flex-col gap-2" data-testid="proposals">
                {decisions.map((one) => (
                  <ProposalRow
                    key={`${one.proposal.date}:${one.proposal.slot}`}
                    decision={one}
                    day={dayOf(one.proposal.date)}
                    slot={tSlots(one.proposal.slot)}
                    onRefuse={(reason) =>
                      setDecisions((current) =>
                        current.map((other) =>
                          other.proposal === one.proposal
                            ? { ...other, refused: reason }
                            : other,
                        ),
                      )
                    }
                  />
                ))}
              </ul>

              {refused.length > 0 && (
                <Input
                  label={t("reviewing.note")}
                  hint={t("reviewing.noteHint")}
                  value={note}
                  maxLength={200}
                  onChange={(event) => setNote(event.target.value)}
                />
              )}

              {failed && (
                <p role="status" className="text-[13px] font-semibold text-coral-ink">
                  {t("failed")}
                </p>
              )}

              <div className="flex flex-wrap gap-3">
                {refused.length > 0 && roundsLeft > 0 ? (
                  <Button
                    data-testid="reask"
                    loading={asking}
                    onClick={() => ask(kept, refused)}
                  >
                    {t("reviewing.reask", { count: refused.length })}
                  </Button>
                ) : (
                  <Button
                    data-testid="accept-week"
                    loading={pending}
                    disabled={kept.length === 0}
                    onClick={accept}
                  >
                    {t("reviewing.accept", { count: kept.length })}
                  </Button>
                )}
                {refused.length > 0 && roundsLeft > 0 && kept.length > 0 && (
                  <Button variant="secondary" loading={pending} onClick={accept}>
                    {t("reviewing.acceptKept", { count: kept.length })}
                  </Button>
                )}
                <Button variant="text" onClick={() => setOpen(false)}>
                  {t("cancel")}
                </Button>
              </div>

              {/* A loop that cannot end is not a conversation. */}
              {roundsLeft <= 0 && (
                <p className="text-[13px] font-semibold text-text-dim">
                  {t("reviewing.enough")}
                </p>
              )}
            </div>
          )}

          {stage === "done" && (
            <div className="mt-3 flex flex-col gap-5">
              <p className="text-[15px] leading-[1.5] font-medium text-text">
                {t("done.body", { count: added })}
              </p>
              <p className="text-[15px] leading-[1.5] font-medium text-text-dim">
                {t("done.shopping")}
              </p>
              <div className="flex flex-wrap gap-3">
                {/* A link that looks like a control: a Button inside a Link
                    would be two interactive elements where the markup
                    promises one. */}
                <Link
                  href={{ pathname: "/app/shopping", query: { week: weekStart } }}
                  data-testid="to-shopping"
                  className={buttonClasses()}
                  onClick={() => setOpen(false)}
                >
                  {t("done.toShopping")}
                </Link>
                <Button variant="secondary" onClick={() => setOpen(false)}>
                  {t("done.stay")}
                </Button>
              </div>
            </div>
          )}
        </Dialog>
      )}
    </>
  );
}

/** One labelled row of chips. Three of them are the whole first screen. */
function Choices({
  label,
  hint,
  values,
  selected,
  nameOf,
  onToggle,
}: {
  label: string;
  hint: string;
  values: readonly string[];
  selected: string[];
  nameOf: (value: string) => string;
  onToggle: (value: string) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
        {label}
      </legend>
      <p className="text-[13px] font-semibold text-text-dim">{hint}</p>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => (
          <Chip
            key={value}
            active={selected.includes(value)}
            onClick={() => onToggle(value)}
          >
            {nameOf(value)}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * One proposal, with the way out of it.
 *
 * Refusing opens the reason list in place rather than in a second dialog: this
 * is the correction loop, and it is walked several times per week.
 */
function ProposalRow({
  decision,
  day,
  slot,
  onRefuse,
}: {
  decision: Decision;
  day: string;
  slot: string;
  onRefuse: (reason: Reason | null) => void;
}) {
  const t = useTranslations("plan.suggest");
  const [choosing, setChoosing] = useState(false);
  const { proposal, refused } = decision;

  return (
    <li
      data-testid={`proposal-${proposal.date}-${proposal.slot}`}
      data-refused={refused ? "true" : undefined}
      className={cn(
        "flex flex-col gap-2 rounded-sm border border-line bg-bg-raised-2 p-3",
        refused && "opacity-60",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
          <span className="capitalize">{day}</span> · {slot}
        </span>
        {proposal.minutes != null && (
          <span className="tnum font-mono text-[11px] text-gray">
            {t("minutes", { count: proposal.minutes })}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Drawn while the model was still writing the next dish. */}
        <IdeaThumb illustrationKey={proposal.illustrationKey} title={proposal.title} />
        <span
          data-testid="proposal-title"
          className={cn(
            "font-display text-[15px] leading-[1.2] font-bold break-words text-text",
            refused && "line-through",
          )}
        >
          {proposal.title}
        </span>
        {/* Never blurred: this is a dish nobody has written, and accepting
            it writes a draft to correct rather than a finished recipe. */}
        <Badge tone="mint">{t("newDish")}</Badge>
      </div>

      {refused ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[13px] font-semibold text-text-dim">
            {t(`reasons.${refused}`)}
          </span>
          <Button variant="text" size="sm" onClick={() => onRefuse(null)}>
            {t("undoRefuse")}
          </Button>
        </div>
      ) : choosing ? (
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-text-dim">{t("whyNot")}</span>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((reason) => (
              <Chip
                key={reason}
                onClick={() => {
                  setChoosing(false);
                  onRefuse(reason);
                }}
              >
                {t(`reasons.${reason}`)}
              </Chip>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button
            variant="text"
            size="sm"
            data-testid={`refuse-${proposal.date}-${proposal.slot}`}
            onClick={() => setChoosing(true)}
          >
            <Icon name="close" size={16} /> {t("refuse")}
          </Button>
        </div>
      )}
    </li>
  );
}
