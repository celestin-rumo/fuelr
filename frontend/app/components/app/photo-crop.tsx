"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@ui/button";
import { Dialog } from "@ui/dialog";
import { cn } from "@ui/cn";
import { WHOLE_IMAGE, type Crop } from "@app/lib/resize-image";

/**
 * Keep the recipe, drop the facing page.
 *
 * The frame starts on the whole image, so doing nothing and pressing "done"
 * sends everything: an obligatory tool on the most frequent path is a toll.
 *
 * It works in fractions of the image rather than pixels, which is what lets a
 * frame dragged over a 320px preview apply to a 4000px photograph. And it
 * crops nothing while a finger is moving — the overlay is drawn over a small
 * `<img>`, and the real cut happens once, on confirmation. A 12-megapixel
 * redraw per pointer move would freeze the thread the drag is running on.
 */
type Handle = "nw" | "ne" | "sw" | "se" | "move";

/** Smallest frame, as a fraction. Below this it stops being a crop. */
const MIN = 0.08;

export function PhotoCrop({
  file,
  crop,
  onCancel,
  onDone,
}: {
  file: File;
  /** Where the frame was left last time — a photo stays re-croppable. */
  crop: Crop;
  onCancel: () => void;
  onDone: (crop: Crop) => void;
}) {
  const t = useTranslations("import.crop");
  const [frame, setFrame] = useState<Crop>(crop);
  const stage = useRef<HTMLDivElement>(null);
  const dragging = useRef<{ handle: Handle; startX: number; startY: number; from: Crop } | null>(
    null,
  );
  const [url] = useState(() => URL.createObjectURL(file));

  const clamp = (value: number) => Math.min(1, Math.max(0, value));

  /**
   * The drag, on the element itself rather than on `window`.
   *
   * `setPointerCapture` is what makes a finger that slides off a 44px handle
   * keep driving the frame instead of dropping it wherever it happened to be
   * — and it does that without listeners on the window that have to be added,
   * removed, and remembered on unmount.
   */
  // One handler taking the handle, rather than a factory called during
  // render: `onPointerDown={start("move")}` would run `start` while rendering, and
  // a function that writes a ref must not be reachable from there — the lint
  // rule cannot see that the write is inside the closure, and it is right to
  // refuse to guess.
  function start(event: React.PointerEvent<HTMLElement>, handle: Handle) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = {
      handle,
      startX: event.clientX,
      startY: event.clientY,
      from: frame,
    };
  }

  function drag(event: React.PointerEvent) {
    const held = dragging.current;
    const box = stage.current?.getBoundingClientRect();
    if (!held || !box) return;

    const dx = (event.clientX - held.startX) / box.width;
    const dy = (event.clientY - held.startY) / box.height;
    const from = held.from;

    if (held.handle === "move") {
      // The whole frame travels; it stops at the edges rather than shrinking
      // against them, which is what a dragged rectangle should do.
      setFrame({
        ...from,
        x: Math.min(1 - from.width, Math.max(0, from.x + dx)),
        y: Math.min(1 - from.height, Math.max(0, from.y + dy)),
      });
      return;
    }

    let { x, y, width, height } = from;
    const right = from.x + from.width;
    const bottom = from.y + from.height;

    if (held.handle === "nw" || held.handle === "sw") {
      x = clamp(Math.min(from.x + dx, right - MIN));
      width = right - x;
    } else {
      width = Math.max(MIN, Math.min(1 - from.x, from.width + dx));
    }
    if (held.handle === "nw" || held.handle === "ne") {
      y = clamp(Math.min(from.y + dy, bottom - MIN));
      height = bottom - y;
    } else {
      height = Math.max(MIN, Math.min(1 - from.y, from.height + dy));
    }
    setFrame({ x, y, width, height });
  }

  function stop() {
    dragging.current = null;
  }

  /** Keyboard: the frame is also adjustable without a pointer. */
  function nudge(event: React.KeyboardEvent) {
    const step = event.shiftKey ? 0.1 : 0.02;
    const by = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[
      event.key
    ];
    if (!by) return;
    event.preventDefault();
    setFrame((was) => ({
      ...was,
      x: Math.min(1 - was.width, Math.max(0, was.x + by[0])),
      y: Math.min(1 - was.height, Math.max(0, was.y + by[1])),
    }));
  }

  const percent = (value: number) => `${value * 100}%`;

  const HANDLES: { at: Handle; className: string }[] = [
    // Pulled inward rather than centred on the corner: a 44px target that
    // hangs half outside the image is half unreachable at the edges of the
    // screen, and the dot inside it still marks the corner.
    { at: "nw", className: "top-0 left-0 items-start justify-start cursor-nwse-resize" },
    { at: "ne", className: "top-0 right-0 items-start justify-end cursor-nesw-resize" },
    { at: "sw", className: "bottom-0 left-0 items-end justify-start cursor-nesw-resize" },
    { at: "se", className: "bottom-0 right-0 items-end justify-end cursor-nwse-resize" },
  ];

  return (
    <Dialog
      title={t("title")}
      closeLabel={t("close")}
      onClose={() => {
        URL.revokeObjectURL(url);
        onCancel();
      }}
      data-testid="crop-dialog"
    >
      <div className="flex flex-col gap-4">
        <p className="text-[15px] leading-[1.5] font-medium text-text-dim">
          {t("body")}
        </p>

        <div
          ref={stage}
          // No `overflow-hidden` here: it clipped the corner handles, which
          // straddle the frame's edge — and a clipped handle is not only
          // invisible, it stops being hit-testable, so the drag silently did
          // nothing. The rounding lives on the image instead.
          className="relative touch-none bg-bg-raised-2 select-none"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt=""
            draggable={false}
            className="block max-h-[46vh] w-full rounded-md object-contain"
          />

          {/* What will be thrown away, dimmed. Four strips rather than a
              cut-out, because a box-shadow spread over an arbitrary rectangle
              is one more thing to get wrong at the edges. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: "rgba(0,0,0,.55)",
              clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0,
                ${percent(frame.x)} ${percent(frame.y)},
                ${percent(frame.x)} ${percent(frame.y + frame.height)},
                ${percent(frame.x + frame.width)} ${percent(frame.y + frame.height)},
                ${percent(frame.x + frame.width)} ${percent(frame.y)},
                ${percent(frame.x)} ${percent(frame.y)})`,
            }}
          />

          <div
            role="group"
            aria-label={t("frame")}
            tabIndex={0}
            onKeyDown={nudge}
            onPointerDown={(event) => start(event, "move")}
            onPointerMove={drag}
            onPointerUp={stop}
            onPointerCancel={stop}
            data-testid="crop-frame"
            className={cn(
              "absolute cursor-move border-2 border-accent",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]",
            )}
            style={{
              left: percent(frame.x),
              top: percent(frame.y),
              width: percent(frame.width),
              height: percent(frame.height),
            }}
          >
            {HANDLES.map((handle) => (
              <span
                key={handle.at}
                onPointerDown={(event) => start(event, handle.at)}
                onPointerMove={drag}
                onPointerUp={stop}
                onPointerCancel={stop}
                data-testid={`crop-handle-${handle.at}`}
                // 44px of target around a 12px dot: this is dragged with a
                // finger, on a worktop.
                className={cn("absolute grid size-11", handle.className)}
              >
                <span className="m-[-6px] size-3 rounded-full border-2 border-on-accent bg-accent" />
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            data-testid="crop-done"
            onClick={() => {
              URL.revokeObjectURL(url);
              onDone(frame);
            }}
          >
            {t("done")}
          </Button>
          <Button
            variant="secondary"
            data-testid="crop-reset"
            onClick={() => setFrame(WHOLE_IMAGE)}
          >
            {t("reset")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
