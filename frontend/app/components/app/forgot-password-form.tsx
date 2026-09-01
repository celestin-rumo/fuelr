"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@ui/button";
import { Input } from "@ui/input";

const EMAIL = /.+@.+\..+/;

export function ForgotPasswordForm() {
  const t = useTranslations("forgotPassword");
  const locale = useLocale();

  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const emailOk = EMAIL.test(email.trim());

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!emailOk) {
      setTouched(true);
      return;
    }

    setBusy(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), locale }),
    });
    setBusy(false);
    // Confirmed either way. Whether the address has an account is not
    // something this screen is allowed to reveal.
    setSent(true);
  }

  if (sent) {
    return (
      // Announced, not just shown: the form it replaces is gone, so someone
      // using a screen reader has nothing left to feel their way back to.
      <p
        role="status"
        data-testid="forgot-sent"
        className="text-[14px] leading-[1.6] font-semibold text-mint-ink"
      >
        <span aria-hidden>✓ </span>
        {t("sent", { email: email.trim() })}
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Input
        label={t("email")}
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        status={touched && !emailOk ? "error" : "default"}
        hint={touched && !emailOk ? t("invalidEmail") : undefined}
      />

      <Button type="submit" size="lg" loading={busy}>
        {t("submit")}
      </Button>
    </form>
  );
}
