"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Badge } from "@ui/badge";
import { Button } from "@ui/button";
import { Card } from "@ui/card";
import { ListRow, ListRowMeta, ListRowTitle } from "@ui/list-row";
import { SectionHead } from "@ui/section-head";
import type { DeviceSession } from "@app/lib/api";
import { closeOtherSessions, closeSession } from "@app/[locale]/(app)/app/account/actions";

/**
 * Where the account is signed in, and the way to close what you do not
 * recognise.
 *
 * Each row is what a person can match to the phone in their hand — the
 * browser family and the platform, in words, and when it was last seen.
 * Never an address, never the raw agent string: the point is recognising
 * your own devices, not fingerprinting them. This device is marked and
 * closes only through sign-out, so the button that removes a session can
 * never remove the one you are pressing it from.
 */
export function DevicesPanel({ sessions }: { sessions: DeviceSession[] }) {
  const t = useTranslations("devices");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const others = sessions.filter((one) => !one.current);

  function close(id: string) {
    startTransition(async () => {
      const result = await closeSession(id);
      if (result.ok) router.refresh();
    });
  }

  function closeOthers() {
    startTransition(async () => {
      const result = await closeOtherSessions();
      if (result.ok) router.refresh();
    });
  }

  const when = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
      .format(new Date(iso));

  return (
    <section className="flex flex-col gap-4" data-testid="devices-panel">
      <SectionHead
        as="h2"
        hint={t("hint")}
        action={
          others.length > 0 ? (
            <Button size="sm" variant="secondary" loading={pending} onClick={closeOthers} data-testid="close-others">
              {t("closeOthers", { count: others.length })}
            </Button>
          ) : undefined
        }
      >
        {t("title")}
      </SectionHead>
      <Card as="panel" className="p-0">
        <ul className="flex flex-col">
          {sessions.map((session) => (
            <ListRow
              key={session.id}
              as="li"
              data-testid={`device-${session.id}`}
              selected={session.current}
              trailing={
                session.current ? (
                  <Badge tone="accent">{t("thisDevice")}</Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="quiet"
                    loading={pending}
                    aria-label={t("closeOne", { device: session.device ?? t("unknown") })}
                    data-testid={`close-${session.id}`}
                    onClick={() => close(session.id)}
                  >
                    {t("close")}
                  </Button>
                )
              }
            >
              <ListRowTitle>{session.device ?? t("unknown")}</ListRowTitle>
              <ListRowMeta>
                {t("seen", { when: when(session.lastSeenAt) })} · {t("opened", { when: when(session.openedAt) })}
              </ListRowMeta>
            </ListRow>
          ))}
        </ul>
      </Card>
    </section>
  );
}
