import { getTranslations } from "next-intl/server";
import { apiFetch } from "@app/lib/api";
import type { DeviceSession } from "@app/lib/api";
import { AccountSection } from "@app/components/app/account-section";
import { DevicesPanel } from "@app/components/app/devices-panel";

export const dynamic = "force-dynamic";

/** Where the account is signed in. The password lives on the profile, folded. */
export default async function SecuritySectionPage() {
  const t = await getTranslations("account");
  const sessionsResponse = await apiFetch("/api/auth/sessions");
  const sessions: DeviceSession[] = sessionsResponse.ok ? await sessionsResponse.json() : [];
  return (
    <AccountSection title={t("hub.cards.security.title")} intro={t("sections.security")}>
      {sessions.length > 0 && <DevicesPanel sessions={sessions} />}
    </AccountSection>
  );
}
