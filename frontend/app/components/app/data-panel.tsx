"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@ui/button";
import { Card } from "@ui/card";
import { Dialog } from "@ui/dialog";
import { Input } from "@ui/input";
import { SectionHead } from "@ui/section-head";
import {
  deleteAccount,
  previewDeletion,
  requestExport,
} from "@app/[locale]/(app)/app/account/actions";
import type { DeletionPreview } from "@app/[locale]/(app)/app/account/actions";

/**
 * The two doors out: take everything, or leave.
 *
 * The export is asked for and arrives by mail, because a library with photos
 * is not built inside a click. Deleting asks for the password — an open tab
 * must not be enough — and the dialog says what it will do from what the
 * server reports: "your household passes to Anna", "your 43 recipes", not a
 * generic sentence. The export is offered once on the way, and never blocks.
 */
export function DataPanel({ email }: { email: string }) {
  const t = useTranslations("data");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [exportAsked, setExportAsked] = useState(false);
  const [preview, setPreview] = useState<DeletionPreview | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function askExport() {
    startTransition(async () => {
      const result = await requestExport(locale);
      setExportAsked(result.ok);
    });
  }

  function openDeletion() {
    startTransition(async () => {
      setPreview(await previewDeletion());
      setConfirming(true);
    });
  }

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteAccount(password);
      if (result.ok) {
        // The cookie is gone with the account; the public site is where a
        // person with no account lands.
        router.replace(`/${locale}`);
        router.refresh();
        return;
      }
      setError(t(result.reason === "wrong" ? "delete.wrongPassword" : "delete.failed"));
    });
  }

  return (
    <section className="flex flex-col gap-4" data-testid="data-panel">
      <SectionHead as="h2" hint={t("hint")}>
        {t("title")}
      </SectionHead>

      <Card as="panel" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-[16px] font-bold text-text">{t("export.title")}</h3>
          <p className="max-w-[68ch] text-[13px] leading-[1.5] font-medium text-text-dim">
            {t("export.body")}
          </p>
        </div>
        {exportAsked ? (
          <p role="status" data-testid="export-asked" className="text-[15px] font-medium text-mint-ink">
            {t("export.asked", { email })}
          </p>
        ) : (
          <div>
            <Button variant="secondary" loading={pending} onClick={askExport} data-testid="export-submit">
              {t("export.submit")}
            </Button>
          </div>
        )}
      </Card>

      <Card as="panel" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-[16px] font-bold text-text">{t("delete.title")}</h3>
          <p className="max-w-[68ch] text-[13px] leading-[1.5] font-medium text-text-dim">
            {t("delete.body")}
          </p>
        </div>
        <div>
          <Button variant="dangerText" loading={pending} onClick={openDeletion} data-testid="delete-open">
            {t("delete.open")}
          </Button>
        </div>
      </Card>

      {confirming && (
        <Dialog
          title={t("delete.dialogTitle")}
          closeLabel={t("delete.cancel")}
          data-testid="delete-dialog"
          onClose={() => setConfirming(false)}
        >
          {/* From what the server reports, not from a sentence in the component. */}
          <ul className="mt-3 flex list-disc flex-col gap-1 pl-5 text-[15px] leading-[1.5] font-medium text-text">
            <li>{t("delete.recipes", { count: preview?.recipes ?? 0 })}</li>
            <li>{t("delete.photos", { count: preview?.photos ?? 0 })}</li>
            {preview?.householdHandedOver && preview.newOwnerEmail && (
              <li data-testid="delete-handover">
                {t("delete.handover", { email: preview.newOwnerEmail })}
              </li>
            )}
            <li>{t("delete.journal")}</li>
          </ul>

          {/* Offered once, on the way, and never blocking. */}
          {!exportAsked && (
            <p className="mt-4 text-[13px] leading-[1.5] font-semibold text-text-dim">
              {t("delete.exportFirst")}{" "}
              <button
                type="button"
                onClick={askExport}
                className="text-mint-ink underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]"
              >
                {t("delete.exportLink")}
              </button>
            </p>
          )}

          <form
            className="mt-6 flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              confirm();
            }}
          >
            <Input
              label={t("delete.password")}
              type="password"
              autoComplete="current-password"
              value={password}
              data-testid="delete-password"
              onChange={(event) => setPassword(event.target.value)}
              status={error ? "error" : "default"}
              hint={error ?? undefined}
            />
            <div className="flex flex-wrap gap-3">
              <Button type="submit" variant="danger" loading={pending} disabled={!password} data-testid="delete-confirm">
                {t("delete.confirm")}
              </Button>
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                {t("delete.cancel")}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </section>
  );
}
