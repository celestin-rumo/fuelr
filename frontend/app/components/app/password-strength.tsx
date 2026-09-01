"use client";

import { useTranslations } from "next-intl";

/**
 * The four things a password is checked for. They are shown as a list rather
 * than distilled into one word, because "medium" tells someone nothing about
 * what to change.
 */
export const RULES = [
  { key: "length", test: (value: string) => value.length >= 8 },
  { key: "longer", test: (value: string) => value.length >= 12 },
  { key: "case", test: (value: string) => /\p{Ll}/u.test(value) && /\p{Lu}/u.test(value) },
  { key: "symbol", test: (value: string) => /[\d\p{P}\p{S}]/u.test(value) },
] as const;

export function scoreOf(password: string) {
  return RULES.filter((rule) => rule.test(password)).length;
}

/** Below this the form will refuse the password, so it is a real alert. */
const MIN_LENGTH = 8;

export function PasswordStrength({ password }: { password: string }) {
  const t = useTranslations("register.strength");
  const score = password.length === 0 ? 0 : scoreOf(password);

  // Mint, because a strength meter is progress — and the view already spends
  // its action colour on the submit button. Coral is kept for the one case
  // that really is an alert: a password too short to be accepted at all.
  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const filled = tooShort ? "bg-coral" : "bg-mint";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1" aria-hidden>
          {[1, 2, 3, 4].map((step) => (
            <span
              key={step}
              className={`h-1 flex-1 rounded-full transition-[background-color] duration-[var(--dur)] ease-[var(--ease)] ${
                step <= score ? filled : "bg-bg-raised-2"
              }`}
            />
          ))}
        </div>
        <span
          data-testid="strength-label"
          className={`text-[11px] font-bold tracking-[0.02em] uppercase ${
            tooShort ? "text-coral-ink" : "text-text-dim"
          }`}
        >
          {t(`levels.${score}`)}
        </span>
      </div>

      {/* Announced as one region: four separate live messages while someone
          types would be unusable with a screen reader. */}
      <ul aria-live="polite" className="flex flex-col gap-1">
        {RULES.map((rule) => {
          const met = rule.test(password);
          return (
            <li
              key={rule.key}
              data-met={met}
              className={`flex items-center gap-1.5 text-[12px] font-medium ${
                met ? "text-mint-ink" : "text-gray"
              }`}
            >
              <span aria-hidden>{met ? "✓" : "○"}</span>
              {t(`rules.${rule.key}`)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
