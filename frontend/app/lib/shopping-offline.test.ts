import { afterEach, describe, expect, it, vi } from "vitest";
import type { ShoppingListView } from "./api";
import {
  clearQueue,
  queueTick,
  readList,
  readQueue,
  saveList,
  withQueue,
} from "./shopping-offline";

function listWith(): ShoppingListView {
  return {
    id: 1,
    weekStart: "2026-03-02",
    generatedAt: "2026-03-02T10:00:00Z",
    aisles: [
      {
        aisle: "GROCERY",
        items: [
          {
            id: 10,
            name: "Lentilles",
            quantity: 400,
            unit: "g",
            aisle: "GROCERY",
            source: "PLAN",
            inStock: null,
            toBuy: 400,
            checked: false,
            checkedAt: null,
          },
          {
            id: 11,
            name: "Riz",
            quantity: 200,
            unit: "g",
            aisle: "GROCERY",
            source: "PLAN",
            inStock: null,
            toBuy: 200,
            checked: false,
            checkedAt: null,
          },
        ],
      },
    ],
    covered: [],
    remaining: 2,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the queue of ticks", () => {
  it("keeps one entry per line, so four taps send one answer", () => {
    queueTick({ id: 10, checked: true, at: "2026-03-04T10:00:00Z" });
    queueTick({ id: 10, checked: false, at: "2026-03-04T10:00:05Z" });
    queueTick({ id: 11, checked: true, at: "2026-03-04T10:00:06Z" });

    expect(readQueue()).toEqual([
      { id: 10, checked: false, at: "2026-03-04T10:00:05Z" },
      { id: 11, checked: true, at: "2026-03-04T10:00:06Z" },
    ]);
  });

  it("empties on demand, once the server has taken them", () => {
    queueTick({ id: 10, checked: true, at: "2026-03-04T10:00:00Z" });
    clearQueue();
    expect(readQueue()).toEqual([]);
  });
});

describe("withQueue", () => {
  it("shows what was just ticked, which the server has never heard of", () => {
    const shown = withQueue(listWith(), [
      { id: 10, checked: true, at: "2026-03-04T10:00:00Z" },
    ]);

    expect(shown.aisles[0].items[0].checked).toBe(true);
    expect(shown.aisles[0].items[0].checkedAt).toBe("2026-03-04T10:00:00Z");
    // And the count in the corner follows, or it contradicts the boxes.
    expect(shown.remaining).toBe(1);
  });

  it("leaves the list alone when nothing is waiting", () => {
    const list = listWith();
    expect(withQueue(list, [])).toBe(list);
  });
});

describe("the copy on the device", () => {
  it("comes back as it was saved", () => {
    saveList("2026-03-02", listWith());
    const stored = readList();

    expect(stored?.week).toBe("2026-03-02");
    expect(stored?.list.aisles[0].items).toHaveLength(2);
  });

  it("is dropped once it is too old to be a copy of anything", () => {
    saveList("2026-03-02", listWith());
    // Eight days later, the plan has almost certainly moved on.
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 8 * 24 * 60 * 60 * 1000);

    expect(readList()).toBeNull();
  });

  it("survives a browser that refuses storage entirely", () => {
    // A private window throws on the accessor itself, before any method.
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("denied");
    });

    // A private window is not an error; it is a device with no copy.
    expect(() => saveList("2026-03-02", listWith())).not.toThrow();
    expect(readList()).toBeNull();
    expect(readQueue()).toEqual([]);
  });
});
