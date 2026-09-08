import { getTranslations } from "next-intl/server";
import { getSession } from "@app/lib/session";
import { AccountSection } from "@app/components/app/account-section";
import { DataPanel } from "@app/components/app/data-panel";

export const dynamic = "force-dynamic";

export default async function DataSectionPage() {
  const t = await getTranslations("account");
  const session = await getSession();
  if (!session) return null;
  return (
    <AccountSection title={t("hub.cards.data.title")} intro={t("sections.data")}>
      <DataPanel email={session.email} />
    </AccountSection>
  );
}
