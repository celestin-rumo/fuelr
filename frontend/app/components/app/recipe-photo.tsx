"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@ui/button";
import { cn } from "@ui/cn";
import {
  ACCEPTED_EXTENSIONS,
  MAX_SOURCE_BYTES,
  resizeImage,
} from "@app/lib/resize-image";
import type { ResizeError } from "@app/lib/resize-image";

export function RecipePhoto({
  recipeId,
  hasPhoto,
}: {
  recipeId: number;
  hasPhoto: boolean;
}) {
  const t = useTranslations("recipe.photo");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  // Owned locally: the upload's outcome is known here and now, so the picture
  // must not wait on a server refresh to appear.
  const [photo, setPhoto] = useState(hasPhoto);
  const [error, setError] = useState<ResizeError | "upload_failed" | null>(null);
  // Bumped after every change so the browser refetches instead of showing the
  // previous photo from cache.
  const [version, setVersion] = useState(0);

  async function onPick(file: File) {
    setError(null);
    setBusy(true);

    const resized = await resizeImage(file);
    if (!resized.ok) {
      setBusy(false);
      setError(resized.error);
      return;
    }

    const body = new FormData();
    body.append("file", resized.blob, "photo.jpg");
    const response = await fetch(`/api/recipes/${recipeId}/photo/upload`, {
      method: "POST",
      body,
    });
    setBusy(false);
    if (!response.ok) {
      setError("upload_failed");
      return;
    }
    setPhoto(true);
    setVersion((v) => v + 1);
    // Still refresh, so the rest of the page and the grid agree with it.
    startTransition(() => router.refresh());
  }

  async function onRemove() {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/recipes/${recipeId}/photo/upload`, {
      method: "DELETE",
    });
    setBusy(false);
    if (!response.ok) {
      setError("upload_failed");
      return;
    }
    setPhoto(false);
    setVersion((v) => v + 1);
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[13px] font-semibold text-text-dim">{t("label")}</span>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div
          className={cn(
            "aspect-[4/3] w-full shrink-0 overflow-hidden rounded-md border border-line bg-bg-raised-2 sm:w-56",
          )}
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={version}
              src={`/api/recipes/${recipeId}/photo?v=${version}`}
              alt=""
              data-testid="recipe-photo"
              className="size-full object-cover"
            />
          ) : (
            <div
              aria-hidden
              data-testid="recipe-photo-placeholder"
              className="size-full bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent)_22%,transparent),color-mix(in_srgb,var(--mint)_18%,transparent))]"
            />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              loading={busy}
              onClick={() => input.current?.click()}
            >
              {photo ? t("replace") : t("add")}
            </Button>
            {photo && (
              <Button variant="dangerText" size="sm" onClick={onRemove}>
                {t("remove")}
              </Button>
            )}
          </div>

          {/* Said before anything is picked, not after a rejection. */}
          <p className="text-[12px] font-medium text-gray">
            {t("constraints", {
              megabytes: Math.round(MAX_SOURCE_BYTES / (1024 * 1024)),
            })}
          </p>

          {error && (
            <p
              role="alert"
              data-testid="photo-error"
              className="text-[12px] font-semibold text-coral-ink"
            >
              {t(`errors.${error}`)}
            </p>
          )}
        </div>
      </div>

      <input
        ref={input}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        className="sr-only"
        aria-label={t("field")}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
