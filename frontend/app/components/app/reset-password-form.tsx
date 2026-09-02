"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Banner } from "@ui/banner";
import { Button } from "@ui/button";
import { Input } from "@ui/input";

const MIN_LENGTH = 8;

export function ResetPasswordForm({
  token,
  loginHref,
}: {
  token: string;
  loginHref: string;
}) {
  const t = useTranslations("resetPassword");
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const tooShort = password.length < MIN_LENGTH;
  const mismatch = confirmation.length > 0 && confirmation !== password;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (tooShort || confirmation !== password) {
      setTouched(true);
      return;
    }

    setBusy(true);
    setError(null);
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setBusy(false);

    if (response.ok) {
      setDone(true);
      return;
    }
    const body = await response.json().catch(() => ({}));
    setError(body.error ?? "link_expired");
  }

  if (done) {
    return (
      <div className="flex flex-col gap-5">
        <p
          role="status"
          data-testid="reset-done"
          className="text-[14px] leading-[1.6] font-semibold text-mint-ink"
        >
          <span aria-hidden>✓ </span>
          {t("done")}
        </p>
        <Button size="lg" onClick={() => router.push(loginHref)}>
          {t("goToLogin")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Input
        label={t("password")}
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          setError(null);
        }}
        status={touched && tooShort ? "error" : "default"}
        hint={t("minLength", { count: MIN_LENGTH })}
      />

      <Input
        label={t("confirmation")}
        type="password"
        autoComplete="new-password"
        value={confirmation}
        onChange={(e) => {
          setConfirmation(e.target.value);
          setError(null);
        }}
        status={mismatch ? "error" : "default"}
        hint={mismatch ? t("mismatch") : undefined}
      />

      {error && (
        <Banner tone="error" data-testid="reset-error">
          {t(`errors.${error}`)}
        </Banner>
      )}

      <Button type="submit" size="lg" loading={busy}>
        {t("submit")}
      </Button>
    </form>
  );
}
