import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { preloadIllustration, useIllustration } from "./use-illustration";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });
const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

it("looks at once, then every couple of seconds, and stops once the picture is there", async () => {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce({ ok: false } as Response)
    .mockResolvedValueOnce({ ok: true } as Response);
  const { result } = renderHook(() => useIllustration("/api/recipes/7/photo", true));

  // At once: the picture is often drawn before the row is even shown.
  await flush();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("HEAD");
  expect(result.current).toBe(false);

  await tick(2_500);
  expect(result.current).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(2);

  // Landed: nobody asks again.
  await tick(10_000);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("never asks for a dish that is not waiting for a picture", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch");
  renderHook(() => useIllustration("/api/recipes/7/photo", false));
  await tick(10_000);
  expect(fetchMock).not.toHaveBeenCalled();
});

it("gives up after half a minute", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false } as Response);
  renderHook(() => useIllustration("/api/recipes/7/photo", true));
  await tick(60_000);
  expect(fetchMock).toHaveBeenCalledTimes(12);
});

it("preloads a proposal's picture, waiting for it to be drawn, and reads its bytes", async () => {
  const blob = vi.fn(async () => new Blob());
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce({ ok: false } as Response)
    .mockResolvedValueOnce({ ok: true, blob } as unknown as Response);

  const waiting = preloadIllustration("abc");
  await tick(2_500);

  await expect(waiting).resolves.toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[0][0]).toBe("/api/ideas/illustrations/abc");
  // Read, so the row that shows it a moment later paints from the cache.
  expect(blob).toHaveBeenCalled();
});

it("gives a picture that never comes half a minute, then gives up on it", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false } as Response);
  const waiting = preloadIllustration("abc");
  await tick(60_000);
  await expect(waiting).resolves.toBe(false);
});
