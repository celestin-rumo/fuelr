import { getTranslations } from "next-intl/server";
import { apiFetch } from "@app/lib/api";
import type { DietaryPreferences, Reminder } from "@app/lib/api";
import { Disclosure } from "@ui/disclosure";
import { AccountSection } from "@app/components/app/account-section";
import { PreferencesPanel } from "@app/components/app/preferences-panel";
import { ReminderPanel } from "@app/components/app/reminder-panel";

export const dynamic = "force-dynamic";

export default async function PreferencesSectionPage() {
  const t = await getTranslations("account");
  const [preferencesResponse, reminderResponse] = await Promise.all([
    apiFetch("/api/preferences"),
    apiFetch("/api/account/reminder"),
  ]);
  const preferences: DietaryPreferences | null = preferencesResponse.ok ? await preferencesResponse.json() : null;
  const reminder: Reminder | null = reminderResponse.ok ? await reminderResponse.json() : null;

  return (
    <AccountSection title={t("hub.cards.preferences.title")} intro={t("sections.preferences")}>
      {preferences && <PreferencesPanel preferences={preferences} />}
      {reminder && (
        <Disclosure title={t("hub.reminder")} hint={t("hub.reminderHint")} defaultOpen={reminder.day != null} data-testid="disclosure-reminder">
          <ReminderPanel reminder={reminder} />
        </Disclosure>
      )}
    </AccountSection>
  );
}
