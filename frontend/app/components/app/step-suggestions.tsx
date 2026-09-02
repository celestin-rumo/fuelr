"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@ui/cn";

/**
 * Ready-made steps, offered on "/".
 *
 * The catalogue is fixed and written in advance — the same list for everybody,
 * in the three languages. Suggesting steps *from the recipe's own contents*
 * would be a different thing entirely, and belongs to the paid epic; this is a
 * shortcut for text people retype, not a machine that reads.
 *
 * What is inserted is ordinary text. The duration and the speed are corrected
 * afterwards like anything else typed, because a step that cannot be edited is
 * a form field pretending to be a sentence.
 */
const CATALOGUE = [
  // A food processor's stock phrases, which are the ones retyped most.
  "blend",
  "knead",
  "steam",
  "chop",
  "emulsify",
  // The gestures every recipe has.
  "preheat",
  "sear",
  "simmer",
  "boil",
  "season",
  "rest",
  "setAside",
  "bake",
] as const;

export type SuggestionKey = (typeof CATALOGUE)[number];

/**
 * The "/" query the caret is inside, if any.
 *
 * A slash only opens the list at the start of the field or after a space, and
 * a space closes it again. That is what keeps "1/2 citron" typable: the slash
 * there follows a digit, so it is a fraction and not a command — which is the
 * failure people meet first with this convention.
 */
export function slashQuery(
  text: string,
  caret: number,
): { start: number; query: string } | null {
  for (let i = caret - 1; i >= 0; i--) {
    const character = text[i];
    if (character === "/") {
      const before = i === 0 ? "" : text[i - 1];
      if (before !== "" && !/\s/.test(before)) return null;
      return { start: i, query: text.slice(i + 1, caret) };
    }
    // The query is one word: a space means the slash is behind us and done.
    if (/\s/.test(character)) return null;
  }
  return null;
}

export function StepTextarea({
  value,
  onChange,
  label,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
  className?: string;
}) {
  const t = useTranslations("recipe.steps");
  const field = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<{ start: number; query: string } | null>(null);
  const [active, setActive] = useState(0);
  const [above, setAbove] = useState(false);

  const matches = query
    ? CATALOGUE.filter((key) =>
        normalise(t(`suggestions.${key}`)).includes(normalise(query.query)),
      )
    : [];
  const open = query !== null && matches.length > 0;

  // A list that opens under the field lands under the virtual keyboard on a
  // phone. visualViewport is the part of the page the keyboard has not eaten,
  // so it is what decides which way the list goes.
  useEffect(() => {
    if (!open || !field.current) return;
    const box = field.current.getBoundingClientRect();
    const visible = window.visualViewport?.height ?? window.innerHeight;
    setAbove(visible - box.bottom < 200);
  }, [open]);

  function edit(next: string, caret: number) {
    onChange(next);
    setQuery(slashQuery(next, caret));
    setActive(0);
  }

  function insert(key: SuggestionKey) {
    if (!query || !field.current) return;
    const caret = field.current.selectionStart ?? value.length;
    const text = t(`suggestions.${key}`);
    const next = value.slice(0, query.start) + text + value.slice(caret);
    onChange(next);
    setQuery(null);
    // Back in the field, after what was inserted, so the numbers in it can be
    // corrected straight away.
    const at = query.start + text.length;
    requestAnimationFrame(() => {
      field.current?.focus();
      field.current?.setSelectionRange(at, at);
    });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!open) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => (current + 1) % matches.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => (current - 1 + matches.length) % matches.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      insert(matches[active]);
    } else if (event.key === "Escape") {
      // Closes and inserts nothing: the slash that was typed stays typed.
      event.preventDefault();
      setQuery(null);
    }
  }

  return (
    <div className="relative flex-1">
      <textarea
        ref={field}
        aria-label={label}
        value={value}
        role="combobox"
        aria-expanded={open}
        aria-controls="step-suggestions"
        aria-autocomplete="list"
        onChange={(event) =>
          edit(event.target.value, event.target.selectionStart ?? 0)
        }
        onKeyDown={onKeyDown}
        onBlur={() => setQuery(null)}
        className={className}
      />

      {open && (
        <ul
          id="step-suggestions"
          role="listbox"
          data-testid="step-suggestions"
          className={cn(
            "absolute z-20 max-h-64 w-full max-w-sm overflow-y-auto rounded-md border border-line bg-bg-raised p-1 shadow-e2",
            above ? "bottom-full mb-1" : "top-full mt-1",
          )}
        >
          {matches.map((key, index) => (
            <li key={key}>
              <button
                type="button"
                role="option"
                aria-selected={index === active}
                // The field must keep the caret: a blur here would close the
                // list before the click ever lands.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => insert(key)}
                onMouseEnter={() => setActive(index)}
                className={cn(
                  "flex min-h-11 w-full items-center rounded-sm px-3 text-left text-[15px] font-medium",
                  index === active ? "bg-bg-raised-2 text-text" : "text-text-dim",
                )}
              >
                {t(`suggestions.${key}`)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Accents and case are not what somebody is aiming at when they type "/mix". */
function normalise(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Mn}+/gu, "");
}
