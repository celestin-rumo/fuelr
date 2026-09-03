import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge } from "@ui/badge";
import { cn } from "@ui/cn";

/**
 * Says that something open today will not always be.
 *
 * It sits where a paywall used to, and it is deliberately small: this is not
 * an upsell and there is nothing to buy — no plan can be paid for yet. What it
 * prevents is the quiet version of a broken promise, where somebody builds a
 * month of targets around a feature nobody ever told them was a paid one.
 *
 * Mint rather than lime: lime is the colour of the action on the screen, and
 * there is no action here.
 */
export function LaunchNote({ className }: { className?: string }) {
  const t = useTranslations("launch");

  return (
    <div
      data-testid="launch-note"
      className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", className)}
    >
      <Badge tone="mint">{t("badge")}</Badge>
      <span className="text-[12px] font-medium text-gray">{t("note")}</span>
      {/* Where the answer to "what will it cost?" lives. It used to hang off
          the closed plan card, which is exactly the card that disappears
          while everything is open. */}
      <Link
        href="/pricing"
        className="inline-flex min-h-11 items-center text-[12px] font-semibold text-mint-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)] sm:min-h-0"
      >
        {t("compare")}
      </Link>
    </div>
  );
}
