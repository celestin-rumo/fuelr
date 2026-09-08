"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Button, buttonClasses } from "@ui/button";
import { Badge } from "@ui/badge";
import { Chip } from "@ui/chip";
import { Dialog } from "@ui/dialog";
import { Stepper } from "@ui/stepper";
import { cn } from "@ui/cn";
import { CUISINES } from "@app/lib/cuisines";
import { formatDay, weekDays } from "@app/lib/week";
import type { Slot } from "@app/lib/week";
import type { BatchMember, BatchSet, BatchSets, Declined } from "@app/lib/api";
import { askLive } from "@app/lib/ideas-stream";
import type { Progress } from "@app/lib/ideas-stream";
import { acceptProposal } from "@app/[locale]/(app)/app/plan/actions";
import { WorkingOn } from "./working-on";
import { IdeaThumb } from "./recipe-thumb";

const INTENTS = ["vegetarian", "protein", "quick", "cheap"] as const;

/** Two is the fewest that shares anything; six is a Sunday afternoon. */
const FEWEST = 2;
const MOST = 6;

type Stage = "asking" | "choosing" | "placing" | "done";

/** A dish and the evening it was given. */
type Placement = { member: BatchMember; date: string };

export function BatchSuggest({
  weekStart,
  /** `date:slot` for every slot that already holds a meal. */
  planned,
}: {
  weekStart: string;
  planned: string[];
}) {
  const t = useTranslations("plan.batch");
  const tWorking = useTranslations("working");
  const tTags = useTranslations("recipe.tags");
  const tCuisines = useTranslations("recipe.cuisines");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("asking");
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  /** The dishes written to the end so far. */
  const [arriving, setArriving] = useState<BatchMember[]>([]);
  // The ask is not a transition: what the stream says has to render the
  // moment it arrives, and a transition holds its updates until it ends.
  const [asking, setAsking] = useState(false);

  const [size, setSize] = useState(4);
  const [intents, setIntents] = useState<string[]>([]);
  const [cuisines, setCuisines] = useState<string[]>([]);

  const [sets, setSets] = useState<BatchSet[]>([]);
  const [declined, setDeclined] = useState<Declined>("NONE");
  const [refused, setRefused] = useState<string[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [added, setAdded] = useState(0);

  const days = weekDays(weekStart);
  /** The dinners nothing is on yet, in order — where a set naturally lands. */
  const free = days.filter((date) => !planned.includes(`${date}:DINNER`));

  function reset() {
    setStage("asking");
    setSets([]);
    setPlacements([]);
    setAdded(0);
    setDeclined("NONE");
    setRefused([]);
    setFailed(false);
  }

  function toggle(list: string[], value: string, set: (next: string[]) => void) {
    set(list.includes(value) ? list.filter((one) => one !== value) : [...list, value]);
  }

  function ask() {
    setFailed(false);
    setProgress(null);
    setArriving([]);
    setAsking(true);
    void (async () => {
      const result = await askLive<BatchSets, BatchMember>("/api/plan/suggest/batch", {
        size,
        intents,
        cuisines,
        // What has already been turned down, by name: every dish here is one
        // nobody has written yet, and an idea has no id.
        excludeTitles: refused,
      }, setProgress, (arrival) => setArriving((list) => [...list, arrival.dish]));
      setAsking(false);
      if (!result.ok) {
        setFailed(true);
        return;
      }
      setSets(result.result.sets);
      setDeclined(result.result.declined);
      setStage("choosing");
    })();
  }

  /**
   * Takes a set and pre-answers the question nobody wants to be asked five
   * times: which evening. The free dinners of the week, in order, and every
   * one of them can still be changed before anything is written.
   */
  function choose(set: BatchSet) {
    setPlacements(
      set.members.map((member, at) => ({
        member,
        date: free[at] ?? days[at % days.length],
      })),
    );
    setStage("placing");
  }

  function place() {
    startTransition(async () => {
      let written = 0;
      for (const one of placements) {
        const result = await acceptProposal({
          date: one.date,
          slot: "DINNER" as Slot,
          title: one.member.title,
          idea: one.member.idea,
        });
        if (result.ok) written += 1;
      }
      setAdded(written);
      setStage("done");
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="secondary"
        data-testid="suggest-batch"
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
          data-testid="batch-dialog"
          onClose={() => setOpen(false)}
        >
          {stage === "asking" && asking && (
            <div className="mt-3 flex flex-col gap-4">
              <WorkingOn
                data-testid="working"
                label={t("working")}
                words={[...intents, ...cuisines].join(" ")}
                progress={progress}
              />
              {arriving.length > 0 && (
                <div className="flex flex-col gap-2" aria-live="polite" data-testid="arriving">
                  <p className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
                    {tWorking("arrived", { count: arriving.length })}
                  </p>
                  <ul className="flex flex-col gap-2">
                    {arriving.map((member, at) => (
                      <li
                        key={`${member.title}-${at}`}
                        data-testid="arriving-member"
                        className="flex items-center gap-3 rounded-sm border border-line bg-bg-raised-2 p-3"
                      >
                        <IdeaThumb illustrationKey={member.illustrationKey} title={member.title} />
                        <span className="font-display text-[15px] leading-[1.2] font-bold break-words text-text">
                          {member.title}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {stage === "asking" && !asking && (
            <div className="mt-3 flex flex-col gap-6">
              <p className="text-[15px] leading-[1.5] font-medium text-text-dim">
                {t("asking.body")}
              </p>

              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
                  {t("asking.size")}
                </span>
                <Stepper
                  data-testid="batch-size"
                  value={size}
                  onChange={setSize}
                  min={FEWEST}
                  max={MOST}
                  size="xl"
                  decreaseLabel={t("asking.fewer")}
                  increaseLabel={t("asking.more")}
                />
              </div>

              <Choices
                label={t("asking.intents")}
                values={INTENTS as readonly string[]}
                selected={intents}
                nameOf={(value) => tTags(value)}
                onToggle={(value) => toggle(intents, value, setIntents)}
              />

              <Choices
                label={t("asking.cuisines")}
                values={CUISINES}
                selected={cuisines}
                nameOf={(value) => tCuisines(value)}
                onToggle={(value) => toggle(cuisines, value, setCuisines)}
              />

              {failed && (
                <p role="status" className="text-[13px] font-semibold text-coral-ink">
                  {t("failed")}
                </p>
              )}

              <div className="flex flex-wrap gap-3">
                <Button onClick={ask} loading={asking}>
                  {t("asking.submit")}
                </Button>
                <Button variant="secondary" onClick={() => setOpen(false)}>
                  {t("cancel")}
                </Button>
              </div>
            </div>
          )}

          {stage === "choosing" && (
            <div className="mt-3 flex flex-col gap-5">
              {/* Nothing batches together is an answer, and it is often the
                  right one: it means the library is varied, not broken. */}
              {sets.length === 0 ? (
                <>
                  <p
                    role="status"
                    data-testid="declined"
                    className="text-[15px] leading-[1.5] font-medium text-text-dim"
                  >
                    {t(`declined.${declined === "NONE" ? "FAILED" : declined}`)}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="secondary" onClick={() => setStage("asking")}>
                      {t("choosing.back")}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[15px] leading-[1.5] font-medium text-text-dim">
                    {t("choosing.body", { count: sets.length })}
                  </p>

                  <ul className="flex flex-col gap-3" data-testid="batch-sets">
                    {sets.map((set, at) => (
                      <SetCard
                        key={at}
                        set={set}
                        index={at}
                        onChoose={() => choose(set)}
                      />
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {stage === "placing" && (
            <div className="mt-3 flex flex-col gap-5">
              <p className="text-[15px] leading-[1.5] font-medium text-text-dim">
                {t("placing.body")}
              </p>

              <ul className="flex flex-col gap-3" data-testid="batch-placements">
                {placements.map((one, at) => (
                  <li
                    key={`${one.member.title}-${at}`}
                    className="flex flex-col gap-2 rounded-sm border border-line bg-bg-raised-2 p-3"
                  >
                    <span className="font-display text-[15px] leading-[1.2] font-bold break-words text-text">
                      {one.member.title}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {days.map((date) => (
                        <Chip
                          key={date}
                          active={date === one.date}
                          onClick={() =>
                            setPlacements((current) =>
                              current.map((other, index) =>
                                index === at ? { ...other, date } : other,
                              ),
                            )
                          }
                        >
                          <span className="capitalize">
                            {formatDay(date, locale, { weekday: "short" })}
                          </span>
                        </Chip>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap gap-3">
                <Button data-testid="place-batch" loading={pending} onClick={place}>
                  {t("placing.submit", { count: placements.length })}
                </Button>
                <Button variant="secondary" onClick={() => setStage("choosing")}>
                  {t("placing.back")}
                </Button>
              </div>
            </div>
          )}

          {stage === "done" && (
            <div className="mt-3 flex flex-col gap-5">
              <p className="text-[15px] leading-[1.5] font-medium text-text">
                {t("done.body", { count: added })}
              </p>
              <p className="text-[15px] leading-[1.5] font-medium text-text-dim">
                {t("done.next")}
              </p>
              <div className="flex flex-wrap gap-3">
                {/* A link that looks like a control, for the reason the rest
                    of this codebase gives: a Button inside a Link is two
                    interactive elements where the markup promises one. */}
                <Link
                  href={{ pathname: "/app/plan/prep", query: { week: weekStart } }}
                  data-testid="to-prep"
                  className={buttonClasses()}
                  onClick={() => setOpen(false)}
                >
                  {t("done.toPrep")}
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

function Choices({
  label,
  values,
  selected,
  nameOf,
  onToggle,
}: {
  label: string;
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
 * One set, and what makes it one.
 *
 * The bases are the whole card: "these four, trust me" asks for faith, and
 * "three of the four are built on the same 900 g of lentils" can be checked in
 * a second by the person reading it.
 */
function SetCard({
  set,
  index,
  onChoose,
}: {
  set: BatchSet;
  index: number;
  onChoose: () => void;
}) {
  const t = useTranslations("plan.batch");

  return (
    <li
      data-testid={`batch-set-${index}`}
      className="flex flex-col gap-3 rounded-md border border-line bg-bg-raised-2 p-4"
    >
      <p className="text-[13px] font-semibold text-text-dim">
        {t("choosing.shared", {
          count: set.sharedBy,
          total: set.members.length,
          base: set.bases[0]?.name ?? "",
        })}
      </p>

      <ul className="flex flex-col gap-1">
        {set.members.map((member, at) => (
          <li key={`${member.title}-${at}`} className="flex flex-wrap items-center gap-2">
            <IdeaThumb illustrationKey={member.illustrationKey} title={member.title} size={36} />
            <span className="font-display text-[15px] leading-[1.2] font-bold break-words text-text">
              {member.title}
            </span>
            <Badge tone="mint">{t("idea")}</Badge>
            {member.minutes != null && (
              <span className="tnum font-mono text-[11px] text-gray">
                {t("minutes", { count: member.minutes })}
              </span>
            )}
          </li>
        ))}
      </ul>

      {/* Every base, not only the headline one: the second and third are what
          say whether the afternoon is really shorter. */}
      {set.bases.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {set.bases.map((base) => (
            <li
              key={`${base.name}-${base.unit}`}
              className={cn(
                "tnum rounded-full bg-bg-raised px-3 py-1 font-mono text-[11px] text-text-dim",
              )}
            >
              {t("base", {
                name: base.name,
                quantity: base.quantity,
                unit: base.unit,
                count: base.dishes,
              })}
            </li>
          ))}
        </ul>
      )}

      <div>
        <Button
          size="sm"
          variant="secondary"
          data-testid={`choose-set-${index}`}
          onClick={onChoose}
        >
          {t("choosing.choose")}
        </Button>
      </div>
    </li>
  );
}
