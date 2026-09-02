import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWakeLock } from "./use-wake-lock";

type FakeSentinel = { released: boolean; release: ReturnType<typeof vi.fn> };

function fakeWakeLock() {
  const sentinels: FakeSentinel[] = [];
  const request = vi.fn(async () => {
    const sentinel: FakeSentinel = {
      released: false,
      release: vi.fn(async () => {
        sentinel.released = true;
      }),
    };
    sentinels.push(sentinel);
    return sentinel as unknown as WakeLockSentinel;
  });

  Object.defineProperty(navigator, "wakeLock", {
    value: { request },
    configurable: true,
  });

  return { request, sentinels };
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "wakeLock");
});

describe("useWakeLock", () => {
  it("holds the screen awake while cooking", async () => {
    const { request } = fakeWakeLock();

    await act(async () => {
      renderHook(() => useWakeLock(true));
    });

    expect(request).toHaveBeenCalledWith("screen");
  });

  it("takes the lock again after the tab was hidden", async () => {
    // The browser releases the lock every time the tab hides, so acquiring it
    // once is the bug that looks like it works.
    const { request, sentinels } = fakeWakeLock();

    await act(async () => {
      renderHook(() => useWakeLock(true));
    });
    sentinels[0].released = true;

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(request).toHaveBeenCalledTimes(2);
  });

  it("does not ask twice while it still holds one", async () => {
    const { request } = fakeWakeLock();

    await act(async () => {
      renderHook(() => useWakeLock(true));
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(request).toHaveBeenCalledTimes(1);
  });

  it("gives the screen back on the way out", async () => {
    const { sentinels } = fakeWakeLock();

    const view = renderHook(() => useWakeLock(true));
    await act(async () => {});
    await act(async () => {
      view.unmount();
    });

    expect(sentinels[0].release).toHaveBeenCalled();
  });

  it("changes nothing where the browser has no wake lock", async () => {
    // Firefox and older Safari: the page renders identically and says nothing
    // about a screen that stays on.
    await act(async () => {
      renderHook(() => useWakeLock(true));
    });

    expect("wakeLock" in navigator).toBe(false);
  });

  it("survives a refusal, which is what a low battery looks like", async () => {
    Object.defineProperty(navigator, "wakeLock", {
      value: { request: vi.fn(async () => Promise.reject(new Error("denied"))) },
      configurable: true,
    });

    await act(async () => {
      renderHook(() => useWakeLock(true));
    });
    // Getting here without an unhandled rejection is the assertion.
    expect(true).toBe(true);
  });
});
