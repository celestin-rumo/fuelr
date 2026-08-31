"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@ui/button";
import { Chip } from "@ui/chip";
import { Input } from "@ui/input";
import { cn } from "@ui/cn";

const EMAIL = /.+@.+\..+/;
const MIN_MESSAGE = 10;

export function ContactForm() {
  const t = useTranslations("site.contact.form");
  const subjects = t.raw("subjects") as string[];

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState(subjects[1] ?? subjects[0]);
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const emailOk = EMAIL.test(email.trim());
  const messageOk = message.trim().length >= MIN_MESSAGE;

  function reset() {
    setSent(false);
    setError("");
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !emailOk || !messageOk) {
      setTouched(true);
      setSent(false);
      setError(
        !name.trim()
          ? t("errors.name")
          : !emailOk
            ? t("errors.email")
            : t("errors.message"),
      );
      return;
    }

    // No contact endpoint exists yet — the submit is simulated so the states
    // are real. Wire this to the backend when the endpoint lands.
    setSending(true);
    setError("");
    window.setTimeout(() => {
      setSending(false);
      setSent(true);
      setMessage("");
    }, 900);
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Input
        label={t("name")}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          reset();
        }}
        status={touched && !name.trim() ? "error" : "default"}
      />

      <Input
        label={t("email")}
        type="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          reset();
        }}
        status={touched && !emailOk ? "error" : "default"}
        hint={touched && !emailOk ? t("errors.emailHint") : t("emailHint")}
      />

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-text-dim">
          {t("subject")}
        </span>
        <div className="flex flex-wrap gap-2">
          {subjects.map((option) => (
            <Chip
              key={option}
              active={subject === option}
              onClick={() => setSubject(option)}
            >
              {option}
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="contact-message"
          className="text-[13px] font-semibold text-text-dim"
        >
          {t("message")}
        </label>
        <textarea
          id="contact-message"
          rows={5}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            reset();
          }}
          aria-invalid={touched && !messageOk ? true : undefined}
          className={cn(
            "w-full rounded-sm border-[1.5px] bg-bg px-4 py-3 text-[15px] text-text",
            "transition-[border-color] duration-[var(--dur-fast)] ease-[var(--ease)]",
            "focus:border-mint-ink focus:outline-2 focus:outline-offset-2 focus:outline-[var(--mint-ink)]",
            touched && !messageOk ? "border-coral-ink" : "border-gray",
          )}
        />
      </div>

      {error && (
        <p role="alert" className="text-[13px] font-semibold text-coral-ink">
          <span aria-hidden>! </span>
          {error}
        </p>
      )}

      {sent && (
        <p role="status" className="text-[13px] font-semibold text-mint-ink">
          <span aria-hidden>✓ </span>
          {t("success")}
        </p>
      )}

      <Button type="submit" size="lg" loading={sending} className="self-start">
        {sending ? t("sending") : sent ? t("sent") : t("submit")}
      </Button>
    </form>
  );
}
