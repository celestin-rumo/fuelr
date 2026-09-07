"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Card } from "@ui/card";
import { SectionHead } from "@ui/section-head";
import { Segmented } from "@ui/segmented";
import { Switch } from "@ui/switch";
import type { Reminder } from "@app/lib/api";
import { setReminder } from "@app/[locale]/(app)/app/account/actions";

const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;
const HOURS = [8, 12, 18, 20] as const;

/**
 * The one email somebody may ask for.
 *
 * Off by default, or it is spam. Everything else Fuelr sends is
 * transactional and cannot be turned off, and the card says so: a password
 * reset you do not receive is not a preference.
 */
export function ReminderPanel({ reminder }: { reminder: Reminder }) {
  const t = useTranslations("reminder");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [day, setDay] = useState<number | null>(reminder.day);
  const [hour, setHour] = useState<number>(reminder.hour ?? 18);

  function save(nextDay: number | null, nextHour: number) {
    setDay(nextDay);
    setHour(nextHour);
    startTransition(async () => {
      const result = await setReminder({ day: nextDay, hour: nextDay == null ? null : nextHour });
      if (result.ok) router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-4" data-testid="reminder-panel">
      <SectionHead as="h2" hint={t("hint")}>
        {t("title")}
      </SectionHead>
      <Card as="panel" className="flex flex-col gap-5">
        <Switch
          checked={day != null}
          disabled={pending}
          data-testid="reminder-switch"
          onChange={(event) => save(event.target.checked ? 7 : null, hour)}
          label={t("switch")}
        />

        {day != null && (
          <>
            <div className="flex flex-col gap-2">
              <p className="text-[13px] font-semibold text-text-dim">{t("day")}</p>
              <Segmented
                label={t("day")}
                className="max-sm:w-full max-sm:flex-col"
                value={String(day)}
                onChange={(value) => save(Number(value), hour)}
                options={DAYS.map((value) => ({ value: String(value), label: t(`days.${value}`) }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-[13px] font-semibold text-text-dim">{t("hour")}</p>
              <Segmented
                label={t("hour")}
                value={String(hour)}
                onChange={(value) => save(day, Number(value))}
                options={HOURS.map((value) => ({ value: String(value), label: `${value}:00` }))}
              />
            </div>
          </>
        )}

        <p className="text-[13px] font-medium text-gray">{t("transactional")}</p>
      </Card>
    </section>
  );
}
