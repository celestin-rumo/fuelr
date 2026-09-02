import { describe, expect, it } from "vitest";
import {
  addDays,
  formatDay,
  isIsoDate,
  isSlot,
  mondayOf,
  todayIso,
  weekDays,
} from "./week";

describe("mondayOf", () => {
  it("keeps a Monday where it is", () => {
    expect(mondayOf("2026-03-02")).toBe("2026-03-02");
  });

  it("puts Sunday at the end of its week, not at the start of the next", () => {
    // 2026-03-08 is a Sunday: it belongs to the week that began on the 2nd.
    expect(mondayOf("2026-03-08")).toBe("2026-03-02");
  });

  it("crosses a month boundary", () => {
    // 2026-03-01 is a Sunday; its Monday is in February.
    expect(mondayOf("2026-03-01")).toBe("2026-02-23");
  });

  it("crosses a year boundary", () => {
    expect(mondayOf("2027-01-01")).toBe("2026-12-28");
  });
});

describe("addDays", () => {
  it("crosses a leap day", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2028-02-29", 1)).toBe("2028-03-01");
  });

  it("goes backwards", () => {
    expect(addDays("2026-03-02", -1)).toBe("2026-03-01");
  });

  /**
   * The reason every date here is UTC. In Zurich, 2026-03-29 is 23 hours long;
   * arithmetic on a local Date lands on the 29th again, and Sunday's dinner
   * quietly becomes Saturday's.
   */
  it("does not lose a day to a daylight-saving change", () => {
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
    expect(addDays("2026-10-24", 1)).toBe("2026-10-25");
    expect(addDays("2026-10-25", 1)).toBe("2026-10-26");
  });
});

describe("weekDays", () => {
  it("is seven days starting on the Monday given", () => {
    expect(weekDays("2026-03-02")).toEqual([
      "2026-03-02",
      "2026-03-03",
      "2026-03-04",
      "2026-03-05",
      "2026-03-06",
      "2026-03-07",
      "2026-03-08",
    ]);
  });
});

describe("isIsoDate", () => {
  it("accepts a calendar day and nothing else", () => {
    expect(isIsoDate("2026-03-02")).toBe(true);
    expect(isIsoDate("2026-3-2")).toBe(false);
    expect(isIsoDate("2026-13-02")).toBe(false);
    expect(isIsoDate("hier")).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });
});

describe("isSlot", () => {
  it("only knows the four slots of a day", () => {
    expect(isSlot("DINNER")).toBe(true);
    expect(isSlot("BRUNCH")).toBe(false);
  });
});

describe("todayIso", () => {
  it("reads the local calendar day, not the UTC one", () => {
    // 23:30 on the 2nd, wherever the test runs: still the 2nd.
    const local = new Date(2026, 2, 2, 23, 30);
    expect(todayIso(local)).toBe("2026-03-02");
  });
});

describe("formatDay", () => {
  it("names the same day whatever the runtime's timezone is", () => {
    expect(formatDay("2026-03-02", "fr", { weekday: "long" })).toBe("lundi");
    expect(formatDay("2026-03-08", "en", { weekday: "long" })).toBe("Sunday");
  });
});
