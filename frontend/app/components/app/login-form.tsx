"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@ui/button";
import { Input } from "@ui/input";

const EMAIL = /.+@.+\..+/;

export function LoginForm({ next }: { next: string | null }) {
  const t = useTranslations("auth.form");
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<string | null>(null);

  const emailOk = EMAIL.test(email.trim());

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!emailOk || password.length === 0) {
      setTouched(true);
      setError("incomplete");
      return;
    }

    setBusy(true);
    setError(null);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    setBusy(false);

    if (response.ok) {
      // Back to whatever was asked for before the guard stepped in.
      router.replace(next && next.startsWith("/") ? next : "/fr/app");
      router.refresh();
      return;
    }

    const body = await response.json().catch(() => ({}));
    setRetryAfter(body.retryAfter ?? null);
    setError(body.error ?? "invalid_credentials");
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Input
        label={t("email")}
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setError(null);
        }}
        status={touched && !emailOk ? "error" : "default"}
      />

      <Input
        label={t("password")}
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          setError(null);
        }}
        status={touched && password.length === 0 ? "error" : "default"}
      />

      {error && (
        <p
          role="alert"
          data-testid="login-error"
          className="text-[13px] font-semibold text-coral-ink"
        >
          <span aria-hidden>! </span>
          {error === "too_many_attempts"
            ? t("errors.too_many_attempts", { seconds: retryAfter ?? "60" })
            : t(`errors.${error}`)}
        </p>
      )}

      <Button type="submit" size="lg" loading={busy}>
        {t("submit")}
      </Button>

      <Link
        href="/forgot-password"
        className="text-center text-[13px] font-semibold text-accent-ink underline"
      >
        {t("forgotLink")}
      </Link>
    </form>
  );
}
