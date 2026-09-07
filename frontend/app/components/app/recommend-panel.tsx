"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@ui/button";
import { Card } from "@ui/card";
import { Input } from "@ui/input";
import { SectionHead } from "@ui/section-head";
import type { Referral } from "@app/lib/api";

/**
 * A link to share, and a text ready to send.
 *
 * Not a referral programme: no plan is paid for, so there is nothing to
 * offer, and promising "a free month" for a subscription that does not exist
 * would be the pricing page in reverse. The count says how many came, which
 * is the one thing worth knowing — and it is a number, never a list.
 */
export function RecommendPanel({ referral }: { referral: Referral }) {
  const t = useTranslations("recommend");
  const [message, setMessage] = useState(t("message", { link: referral.link }));
  const [done, setDone] = useState<"shared" | "copied" | null>(null);

  async function share() {
    // The system sheet where there is one — a phone — and the clipboard
    // where there is not.
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ text: message });
        setDone("shared");
        return;
      } catch {
        // Cancelled, or not allowed: fall through to the clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(message);
      setDone("copied");
    } catch {
      setDone(null);
    }
  }

  return (
    <section className="flex flex-col gap-4" data-testid="recommend-panel">
      <SectionHead as="h2" hint={t("hint")}>
        {t("title")}
      </SectionHead>
      <Card as="panel" className="flex flex-col gap-4">
        <p className="tnum font-mono text-[13px] text-text-dim" data-testid="referral-link">
          {referral.link}
        </p>
        <Input
          label={t("messageLabel")}
          value={message}
          data-testid="referral-message"
          onChange={(event) => setMessage(event.target.value)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={share} data-testid="referral-share">
            {t("share")}
          </Button>
          {done && (
            <span role="status" className="text-[13px] font-semibold text-mint-ink">
              {t(done)}
            </span>
          )}
        </div>
        <p className="text-[13px] font-medium text-gray" data-testid="referral-count">
          {t("count", { count: referral.referred })}
        </p>
        <p className="text-[13px] font-medium text-gray">{t("honest")}</p>
      </Card>
    </section>
  );
}
