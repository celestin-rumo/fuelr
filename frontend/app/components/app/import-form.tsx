"use client";

import { useEffect, useRef, useState } from "react";
import { useHydrated } from "@app/lib/use-hydrated";
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
import { IconButton } from "@ui/button";
import { Icon } from "@ui/icons";
import { PhotoCrop } from "./photo-crop";
import {
  ACCEPTED_EXTENSIONS,
  WHOLE_IMAGE,
  cropImage,
  isWholeImage,
  type Crop,
} from "@app/lib/resize-image";

/**
 * One picture on its way in: the file as it was taken, and the frame somebody
 * dragged over it. The crop is kept beside the file rather than applied to it,
 * so a photograph stays re-croppable until it is sent — you notice you cut off
 * an ingredient by looking at the thumbnail.
 */
type Shot = { id: string; file: File; crop: Crop; preview: string };

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
  const [shots, setShots] = useState<Shot[]>([]);
  const [cropping, setCropping] = useState<Shot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);

  /*
   * Whether a camera exists at all.
   *
   * Read after mount, never during render: the server has no idea, and a
   * button that renders on the server and vanishes on hydration is a flash.
   * `mediaDevices` is the test rather than a user-agent string — and the
   * `capture` attribute below needs no permission, so this only decides
   * whether the button is worth offering. A control that opens a file picker
   * while promising a camera is worse than no control.
   */
  const hydrated = useHydrated();
  const hasCamera = hydrated && Boolean(navigator.mediaDevices);

  // Object URLs are a leak with a nice name: released when the shot goes.
  useEffect(
    () => () => shots.forEach((shot) => URL.revokeObjectURL(shot.preview)),
    [shots],
  );

  /** Pictures accumulate: a recipe spans two pages, and the reader takes several. */
  function add(picked: FileList | null) {
    const taken = Array.from(picked ?? []);
    if (taken.length === 0) return;
    setError(null);
    setShots((was) => [
      ...was,
      ...taken.map((file) => ({
        id: `${file.name}-${file.lastModified}-${Math.random()}`,
        file,
        crop: WHOLE_IMAGE,
        preview: URL.createObjectURL(file),
      })),
    ]);
  }

  function remove(id: string) {
    setShots((was) => {
      was.filter((shot) => shot.id === id).forEach((shot) => URL.revokeObjectURL(shot.preview));
      return was.filter((shot) => shot.id !== id);
    });
  }

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
    if (shots.length === 0) {
      setError("no_file");
      return;
    }
    setBusy(true);
    setError(null);

    // The crop is applied here and nowhere else: what leaves the device is an
    // image, never an original plus coordinates for somebody else to honour.
    // Once, at the end — not on every pointer move.
    const body = new FormData();
    for (const shot of shots) {
      const cut = await cropImage(shot.file, shot.crop);
      if (!cut.ok) {
        setBusy(false);
        setError(cut.error);
        return;
      }
      body.append("files", cut.blob, `${shot.id}.jpg`);
    }

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
          <div className="flex flex-col gap-3">
            <SectionHead as="h3">{t("sources.files")}</SectionHead>

            <div className="flex flex-wrap gap-3">
              {/*
               * The book is open in front of you, now. Without this, that
               * gesture goes through four screens, three of which are not
               * ours.
               *
               * `capture` hands off to the system camera rather than opening a
               * `getUserMedia` stream in the page: the native app brings
               * autofocus, exposure and the whole sensor, which on small print
               * is the difference between a reading that works and one that
               * fails — and a failed reading is billed like a successful one.
               * It also means no camera permission to ask for and no stream to
               * release. On a machine with no camera the browser falls back to
               * the file picker rather than breaking.
               */}
              {hasCamera && (
                <>
                  <input
                    ref={camera}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    data-testid="import-camera"
                    onChange={(event) => {
                      add(event.target.files);
                      event.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="gap-2"
                    data-testid="take-photo"
                    onClick={() => camera.current?.click()}
                  >
                    <Icon name="calendarPlus" size={17} />
                    {t("sources.takePhoto")}
                  </Button>
                </>
              )}

              <input
                id="import-files"
                ref={picker}
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                multiple
                className="sr-only"
                onChange={(event) => {
                  add(event.target.files);
                  event.target.value = "";
                }}
              />
              <Button
                type="button"
                variant={hasCamera ? "tertiary" : "secondary"}
                className="gap-2"
                data-testid="choose-files"
                onClick={() => picker.current?.click()}
              >
                <Icon name="book" size={17} />
                {t("sources.chooseFiles")}
              </Button>
            </div>

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

          {/* Nothing leaves until somebody presses "read": taking a photograph
              is not submitting it. A blurred page shows in the thumbnail and
              not in the result, and a wasted reading costs the same as a good
              one. */}
          {shots.length > 0 && (
            <ul data-testid="import-shots" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {shots.map((shot, index) => (
                <li
                  key={shot.id}
                  className="relative overflow-hidden rounded-md border border-line bg-bg-raised-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={shot.preview}
                    alt=""
                    className="block aspect-[3/4] w-full object-cover"
                  />
                  <span className="absolute top-2 left-2 rounded-full bg-[rgba(18,18,18,.7)] px-2 py-0.5 font-mono text-[11px] font-bold text-[#f5f5f0]">
                    {index + 1}
                    {!isWholeImage(shot.crop) && ` · ${t("crop.cropped")}`}
                  </span>
                  <div className="absolute right-1 bottom-1 flex gap-1">
                    <IconButton
                      aria-label={t("crop.open", { number: index + 1 })}
                      variant="tertiary"
                      data-testid={`crop-${index}`}
                      onClick={() => setCropping(shot)}
                    >
                      <Icon name="pencil" />
                    </IconButton>
                    <IconButton
                      aria-label={t("removeShot", { number: index + 1 })}
                      variant="dangerText"
                      className="bg-bg-raised"
                      data-testid={`remove-shot-${index}`}
                      onClick={() => remove(shot.id)}
                    >
                      <Icon name="trash" />
                    </IconButton>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {error && <Failure error={error} />}

          {/* Not disabled with nothing picked: a disabled control explains
              nothing, and the refusal below names what is missing. */}
          <Button type="submit" size="lg" loading={busy}>
            {t("sources.submit")}
          </Button>

          {cropping && (
            <PhotoCrop
              file={cropping.file}
              crop={cropping.crop}
              onCancel={() => setCropping(null)}
              onDone={(crop) => {
                setShots((was) =>
                  was.map((shot) => (shot.id === cropping.id ? { ...shot, crop } : shot)),
                );
                setCropping(null);
              }}
            />
          )}
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
