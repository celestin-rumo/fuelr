import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useIllustration } from "./use-illustration";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("asks the photo route until the picture has landed, then stops", async () => {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce({ ok: false } as Response)
    .mockResolvedValueOnce({ ok: true } as Response);
  const { result } = renderHook(() => useIllustration(7, true));
  expect(result.current).toBe(false);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(2_500);
  });
  expect(result.current).toBe(false);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2_500);
  });
  expect(result.current).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[0][0]).toBe("/api/recipes/7/photo");
  expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("HEAD");

  // Landed: nobody asks again.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10_000);
  });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("never asks for a dish that is not waiting for a picture", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch");
  renderHook(() => useIllustration(7, false));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10_000);
  });
  expect(fetchMock).not.toHaveBeenCalled();
});

it("gives up after half a minute", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false } as Response);
  renderHook(() => useIllustration(7, true));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60_000);
  });
  expect(fetchMock).toHaveBeenCalledTimes(12);
});
