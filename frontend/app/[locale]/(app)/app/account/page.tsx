import { getTranslations } from "next-intl/server";
import { apiFetch } from "@app/lib/api";
import type { ProfileResponse } from "@app/lib/api";
import { getSession } from "@app/lib/session";
import { Container } from "@app/components/site/section";
import { AccountPanel } from "@app/components/app/account-panel";

export const dynamic = "force-dynamic";

/**
 * Where somebody sees and corrects what Fuelr knows about them.
 *
 * The profile express was written once at registration and never shown
 * again; the name and the address had no screen at all. This is that screen.
 * The profile may be missing — an account created before the onboarding, or
 * one that skipped it — and that is a state the panel shows, not an error.
 */
export default async function AccountPage() {
  const t = await getTranslations("account");
  const session = await getSession();
  const response = await apiFetch("/api/profile");
  const profile: ProfileResponse | null = response.ok ? await response.json() : null;

  return (
    <Container className="flex max-w-3xl flex-col gap-8 py-14">
      <div className="flex flex-col gap-3">
        <span className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
          {t("label")}
        </span>
        <h1 className="font-display text-[32px] leading-[1.1] font-extrabold tracking-[-0.02em] text-text">
          {t("title")}
        </h1>
        <p className="max-w-[68ch] text-[15px] leading-[1.5] font-medium text-text-dim">
          {t("intro")}
        </p>
      </div>

      {session && <AccountPanel session={session} profile={profile} />}
    </Container>
  );
}
