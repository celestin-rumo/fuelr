import { getTranslations } from "next-intl/server";
import { apiFetch } from "@app/lib/api";
import type { DeviceSession } from "@app/lib/api";
import { getSession } from "@app/lib/session";
import { Disclosure } from "@ui/disclosure";
import { AccountSection } from "@app/components/app/account-section";
import { AccountPanel } from "@app/components/app/account-panel";
import { DevicesPanel } from "@app/components/app/devices-panel";

export const dynamic = "force-dynamic";

/** The devices open — that is what somebody checks — and the password behind a fold. */
export default async function SecuritySectionPage() {
  const t = await getTranslations("account");
  const session = await getSession();
  if (!session) return null;
  const sessionsResponse = await apiFetch("/api/auth/sessions");
  const sessions: DeviceSession[] = sessionsResponse.ok ? await sessionsResponse.json() : [];

  return (
    <AccountSection title={t("hub.cards.security.title")} intro={t("sections.security")}>
      <Disclosure title={t("password.title")} hint={t("password.hint")} data-testid="disclosure-password">
        <AccountPanel session={session} profile={null} sections={["password"]} />
      </Disclosure>
      {sessions.length > 0 && <DevicesPanel sessions={sessions} />}
    </AccountSection>
  );
}
