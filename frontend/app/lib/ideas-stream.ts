/**
 * An answer told as it is written.
 *
 * The three screens that ask a model for dishes post to a `/live` route and
 * read server-sent events back: `progress` as each dish is started, `dish`
 * as each one is written to the end — the row shows up while the next is
 * being written — then one `result` carrying the same object the one-piece
 * endpoint returns, or `failed`. `fetch` rather than `EventSource`, because the ask is a POST with
 * a body and EventSource can only GET.
 *
 * What the caller gets is exactly what it got before — an answer, or not —
 * plus a callback in between. A stream that ends without a `result` is a
 * failure, not an empty answer: the two look alike on the wire and are not.
 */
export type Progress = {
  /** The dish just started, counted from one. */
  done: number;
  /** How many were asked for. */
  of: number;
  title: string;
};

/** A dish written to the end, shaped the way the answer will shape it. */
export type Arrival<D> = {
  index: number;
  of: number;
  dish: D;
};

export async function askLive<T, D = unknown>(
  url: string,
  body: unknown,
  onProgress: (progress: Progress) => void,
  onDish?: (arrival: Arrival<D>) => void,
  /** Cancelling closes the stream; the answer, if any, is simply not read. */
  signal?: AbortSignal,
): Promise<{ ok: true; result: T } | { ok: false; cancelled?: boolean }> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    return { ok: false, cancelled: signal?.aborted };
  }
  if (!response.ok || !response.body) return { ok: false };

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let event = "";
  let data = "";
  let result: T | undefined;
  let failed = false;

  function dispatch() {
    if (event === "progress") onProgress(JSON.parse(data) as Progress);
    else if (event === "dish") onDish?.(JSON.parse(data) as Arrival<D>);
    else if (event === "result") result = JSON.parse(data) as T;
    else if (event === "failed") failed = true;
    event = "";
    data = "";
  }

  try {
    for (;;) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      let at: number;
      while ((at = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, at).replace(/\r$/, "");
        buffer = buffer.slice(at + 1);
        if (line === "") {
          if (event || data) dispatch();
        } else if (line.startsWith("event:")) {
          event = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          data += line.slice(5).trim();
        }
      }
      if (done) break;
    }
    if (event || data) dispatch();
  } catch {
    return { ok: false, cancelled: signal?.aborted };
  }
  if (failed || result === undefined) return { ok: false };
  return { ok: true, result };
}
