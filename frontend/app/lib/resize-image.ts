/** What the backend accepts. Announced in the UI before anything is picked. */
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ACCEPTED_EXTENSIONS = ".jpg,.jpeg,.png,.webp";

/** Ceiling on what the user may pick, checked before any work is done. */
export const MAX_SOURCE_BYTES = 12 * 1024 * 1024;

/** Longest edge after resizing. Cards show a 4:3 tile, so this is generous. */
const MAX_EDGE = 1600;
const QUALITY = 0.82;

export type ResizeError = "unsupported_format" | "file_too_large" | "unreadable";

/**
 * Shrinks the picture in the browser before it is uploaded.
 *
 * A phone photo is several megabytes of detail nobody will see in a 4:3 card,
 * and sending the original would waste the user's connection and the volume's
 * space. The original file never leaves the device.
 */
export async function resizeImage(
  file: File,
): Promise<{ ok: true; blob: Blob } | { ok: false; error: ResizeError }> {
  if (!ACCEPTED_TYPES.includes(file.type as (typeof ACCEPTED_TYPES)[number])) {
    return { ok: false, error: "unsupported_format" };
  }
  if (file.size > MAX_SOURCE_BYTES) {
    return { ok: false, error: "file_too_large" };
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { ok: false, error: "unreadable" };
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return { ok: false, error: "unreadable" };
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    // JPEG whatever came in: the card never needs transparency, and it keeps
    // the uploaded file small and predictable.
    canvas.toBlob(resolve, "image/jpeg", QUALITY),
  );
  if (!blob) return { ok: false, error: "unreadable" };
  return { ok: true, blob };
}
