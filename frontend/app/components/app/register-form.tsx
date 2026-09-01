"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@ui/button";
import { Input } from "@ui/input";
import { PasswordStrength } from "./password-strength";
import { clearDraft, isComplete, readDraft } from "@app/lib/onboarding";

const EMAIL = /.+@.+\..+/;
const MIN_LENGTH = 8;

export function RegisterForm() {
  const t = useTranslations("register");
  const locale = useLocale();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [taken, setTaken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const emailOk = EMAIL.test(email.trim());
  const passwordOk = password.length >= MIN_LENGTH;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !emailOk || !passwordOk) {
      setTouched(true);
      return;
    }

    setBusy(true);
    setError(null);
    setTaken(null);
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), email: email.trim(), password, locale }),
    });
    setBusy(false);

    if (response.ok) {
      // The onboarding answers were given before there was an account to hold
      // them. This is the moment they get one — and if it fails, the account
      // still exists and the profile can be filled in later, so it is not
      // allowed to block the way in.
      const draft = readDraft();
      if (isComplete(draft)) {
        const saved = await fetch("/api/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        });
        if (saved.ok) clearDraft();
      }

      router.replace(`/${locale}/app`);
      router.refresh();
      return;
    }

    if (response.status === 409) {
      // Said under the field, not in a dialog: the fix is one field away, and
      // a modal would hide the form they need to correct.
      setTaken(email.trim());
      return;
    }
    setError("failed");
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Input
        label={t("name")}
        autoComplete="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        status={touched && !name.trim() ? "error" : "default"}
      />

      <div className="flex flex-col gap-2">
        <Input
          label={t("email")}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setTaken(null);
          }}
          status={taken || (touched && !emailOk) ? "error" : "default"}
          hint={touched && !emailOk && !taken ? t("invalidEmail") : undefined}
        />
        {taken && (
          <p
            data-testid="email-taken"
            className="text-[13px] font-semibold text-coral-ink"
          >
            <span aria-hidden>! </span>
            {t("emailTaken")}{" "}
            <Link
              href={{ pathname: "/login", query: { email: taken } }}
              className="text-accent-ink underline"
            >
              {t("signInInstead")}
            </Link>
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <Input
          label={t("password")}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          status={touched && !passwordOk ? "error" : "default"}
        />
        <PasswordStrength password={password} />
      </div>

      {error && (
        <p
          role="alert"
          data-testid="register-error"
          className="text-[13px] font-semibold text-coral-ink"
        >
          <span aria-hidden>! </span>
          {t("errors.failed")}
        </p>
      )}

      <Button type="submit" size="lg" loading={busy}>
        {t("submit")}
      </Button>

      <p className="text-center text-[13px] font-medium text-text-dim">
        {t("haveAccount")}{" "}
        <Link href="/login" className="font-semibold text-accent-ink underline">
          {t("signIn")}
        </Link>
      </p>
    </form>
  );
}
