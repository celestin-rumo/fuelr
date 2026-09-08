import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Icon } from "@ui/icons";
import { Container } from "@app/components/site/section";

/**
 * One section of the account, on a page of its own.
 *
 * The hub chose the first level; this frame says where you are and how to
 * go back, and nothing else competes with the forms below it.
 */
export async function AccountSection({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  const t = await getTranslations("account");
  return (
    <Container className="flex max-w-3xl flex-col gap-8 py-10 sm:py-14">
      <div className="flex flex-col gap-4">
        <Link
          href="/app/account"
          data-testid="account-back"
          className="inline-flex min-h-11 w-fit items-center gap-2 text-[13px] font-semibold text-mint-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)] sm:min-h-0"
        >
          <Icon name="arrowLeft" size={16} />
          {t("back")}
        </Link>
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
            {t("label")}
          </span>
          <h1 className="font-display text-[28px] leading-[1.1] font-extrabold tracking-[-0.02em] text-text sm:text-[32px]">
            {title}
          </h1>
          <p className="max-w-[68ch] text-[15px] leading-[1.5] font-medium text-text-dim">{intro}</p>
        </div>
      </div>
      {children}
    </Container>
  );
}
