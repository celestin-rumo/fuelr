"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Banner } from "@ui/banner";
import { Button } from "@ui/button";
import { Input } from "@ui/input";
import { LaunchNote } from "./launch-note";
import type { ImportSource, ImportSourceState } from "@app/lib/api";
import { Segmented } from "@ui/segmented";
import { SectionHead } from "@ui/section-head";

/**
 * Three ways into the same editor.
 *
 * A link is read by a parser and is free. A photo or a screenshot is read by a
 * model, costs money per reading, and is therefore the one thing the launch
 * period does not open. Which of the three are usable is asked of the server
 * before any of them is offered — the screen never shows a button it will then
 * refuse, and when it cannot offer one it says which of the two reasons it is:
 * a plan somebody can buy, or a provider only we can wire.
 */
export function ImportForm({
  sources,
  openPeriod = false,
}: {
  sources: ImportSource[];
  /** True while nothing is charged. An open door is then worth naming. */
  openPeriod?: boolean;
}) {
  const t = useTranslations("import");
  const locale = useLocale();
  const router = useRouter();

  const [source, setSource] = useState<ImportSource["source"]>("URL");
  const [url, setUrl] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const chosen = sources.find((one) => one.source === source);
  const open = chosen?.state === "OPEN";

  function pick(next: ImportSource["source"]) {
    setSource(next);
    setError(null);
  }

  /** Both paths land in the editor: an import is a draft to correct. */
  function landed(recipe: { id: number }) {
    router.replace(`/${locale}/app/recettes/${recipe.id}`);
    router.refresh();
  }

  async function failed(response: Response) {
    setBusy(false);
    const body = await response.json().catch(() => ({}));
    setError(body.error ?? "unreachable");
  }

  async function submitUrl(event: React.FormEvent) {
    event.preventDefault();
    if (!/^https?:\/\/\S+\.\S+/i.test(url.trim())) {
      setError("not_a_url");
      return;
    }
    setBusy(true);
    setError(null);
    const response = await fetch("/api/recipes/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.trim() }),
    });
    if (response.ok) return landed(await response.json());
    await failed(response);
  }

  async function submitPhotos(event: React.FormEvent) {
    event.preventDefault();
    if (files.length === 0) {
      setError("no_file");
      return;
    }
    setBusy(true);
    setError(null);
    const body = new FormData();
    files.forEach((file) => body.append("files", file));
    const response = await fetch(`/api/recipes/import/photos?source=${source}`, {
      method: "POST",
      body,
    });
    if (response.ok) return landed(await response.json());
    await failed(response);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <SectionHead as="h3">{t("sources.label")}</SectionHead>
        <Segmented
          label={t("sources.label")}
          data-testid="import-sources"
          value={source}
          onChange={pick}
          options={sources.map((one) => ({
            value: one.source,
            label: t(`sources.${one.source}`),
            testId: `source-${one.source}`,
          }))}
        />
      </div>

      {source === "URL" ? (
        <form onSubmit={submitUrl} noValidate className="flex flex-col gap-5">
          <Input
            label={t("url")}
            type="url"
            inputMode="url"
            placeholder="https://…"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setError(null);
            }}
            status={error ? "error" : "default"}
            hint={t("sources.urlHint")}
          />
          {error && <Failure error={error} />}
          <Button type="submit" size="lg" loading={busy}>
            {t("submit")}
          </Button>
        </form>
      ) : open ? (
        <form onSubmit={submitPhotos} noValidate className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="import-files"
              className="text-[13px] font-semibold text-text"
            >
              {t("sources.files")}
            </label>
            <input
              id="import-files"
              ref={picker}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(event) => {
                setFiles(Array.from(event.target.files ?? []));
                setError(null);
              }}
              className="min-h-11 w-full rounded-sm border-[1.5px] border-gray bg-bg px-4 py-2 text-[15px] text-text file:mr-3 file:rounded-full file:border-0 file:bg-bg-raised-2 file:px-4 file:py-2 file:text-[13px] file:font-bold file:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]"
            />
            <span className="text-[12px] font-medium text-gray">
              {source === "PHOTO" ? t("sources.photoHint") : t("sources.screenshotHint")}
            </span>
            <span className="text-[12px] font-medium text-gray">
              {t("sources.filesHint")}
            </span>
            {/* Reading an image is billed per read, and it is being given
                away. Saying so is the difference between a gift and a
                surprise on the day it stops being one. */}
            {openPeriod && <LaunchNote className="mt-1" />}
          </div>

          {error && <Failure error={error} />}

          <Button type="submit" size="lg" loading={busy}>
            {t("sources.submit")}
          </Button>
        </form>
      ) : (
        // Not a dead button and not a mystery: the reason has a name, and the
        // one somebody can act on says what it costs.
        <Banner
          tone="info"
          data-testid={`import-closed-${chosen?.state ?? "SOON"}`}
          title={t(`closed.${chosen?.state ?? "SOON"}.title`, {
            tier: chosen?.requiredTier ?? "",
          })}
          action={
            <Link href="/pricing" className="text-[13px] font-semibold text-mint-ink underline">
              {t(`closed.${chosen?.state ?? "SOON"}.link`)}
            </Link>
          }
        >
          {t(`closed.${chosen?.state ?? "SOON"}.body`)}
        </Banner>
      )}

      {/* Always offered, not only after a failure: some pages will never be
          readable, and the way forward should not depend on trying first. */}
      <p className="text-center text-[13px] font-medium text-text-dim">
        {t("orManual")}{" "}
        {/* The internal path: next-intl resolves the locale slug itself. */}
        <Link href="/app/recipes/new" className="font-semibold text-accent-ink underline">
          {t("manualLink")}
        </Link>
      </p>
    </div>
  );
}

function Failure({ error }: { error: string }) {
  const t = useTranslations("import.errors");
  return (
    <Banner tone="error" data-testid="import-error" title={t(`${error}.title`)}>
      {t(`${error}.body`)}
    </Banner>
  );
}

export type { ImportSourceState };
