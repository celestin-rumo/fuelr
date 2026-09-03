import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@app/test/render";
import type { LogDay, LogHistory, LogWeek } from "@app/lib/api";
import { weekDays } from "@app/lib/week";
import { Journal } from "./journal";

const refresh = vi.fn();
const router = { push: vi.fn(), replace: vi.fn(), refresh };

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => router,
  Link: ({
    children,
    ...props
  }: React.ComponentProps<"a"> & { href: unknown }) => (
    <a {...props} href="#">
      {children}
    </a>
  ),
}));

const logMeal = vi.fn(async () => ({ ok: true }));
const removeEntry = vi.fn(async () => ({ ok: true }));
const restoreEntry = vi.fn(async () => ({ ok: true }));
const setTargets = vi.fn(async () => ({ ok: true, targets: {} }));
const history = vi.fn(async () => null as LogHistory | null);
const nutritionDetail = vi.fn(async () => ({ ok: false, reason: "failed" }));

vi.mock("@app/[locale]/(app)/app/journal/actions", () => ({
  logMeal: (...args: unknown[]) => logMeal(...(args as [])),
  removeEntry: (...args: unknown[]) => removeEntry(...(args as [])),
  restoreEntry: (...args: unknown[]) => restoreEntry(...(args as [])),
  setTargets: (...args: unknown[]) => setTargets(...(args as [])),
  history: (...args: unknown[]) => history(...(args as [])),
  nutritionDetail: (...args: unknown[]) => nutritionDetail(...(args as [])),
}));

const MONDAY = "2026-03-02";

function day(date: string, kcal: number | null): LogDay {
  return {
    date,
    logged: kcal !== null,
    meals: kcal === null ? 0 : 1,
    kcal: kcal ?? 0,
    proteinG: kcal === null ? 0 : 30,
    carbsG: kcal === null ? 0 : 40,
    fatG: kcal === null ? 0 : 20,
    estimated: false,
  };
}

function weekWith(overrides: Partial<LogWeek> = {}): LogWeek {
  const days = weekDays(MONDAY).map((date, index) =>
    day(date, index === 0 ? 1800 : null),
  );
  return {
    weekStart: MONDAY,
    days,
    entries: [
      {
        id: 1,
        date: MONDAY,
        slot: "DINNER",
        title: "Pizza chez Luigi",
        servings: 1,
        kcal: 1800,
        proteinG: 30,
        carbsG: 40,
        fatG: 20,
        estimated: true,
        source: "FREE",
        recipeId: null,
        plannedMealId: null,
      },
    ],
    average: { ...day(MONDAY, 1800), date: null },
    loggedDays: 1,
    targets: null,
    insights: [],
    tracking: false,
    ...overrides,
  };
}

function renderJournal(week = weekWith(), canOrder = false) {
  return renderWithIntl(
    <Journal week={week} weekStart={MONDAY} today={MONDAY} canOrder={canOrder} />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Journal", () => {
  it("lets a free account write a meal down and read it back", async () => {
    const user = userEvent.setup();
    renderJournal();

    expect(screen.getByTestId("entries")).toHaveTextContent("Pizza chez Luigi");

    await user.type(screen.getByLabelText("Repas"), "Kebab");
    await user.type(screen.getByLabelText("kcal"), "750");
    await user.click(screen.getByRole("button", { name: "Noter" }));

    await waitFor(() =>
      expect(logMeal).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Kebab", kcal: 750, date: MONDAY }),
      ),
    );
  });

  it("refuses an entry with nothing to call it", async () => {
    const user = userEvent.setup();
    renderJournal();

    await user.type(screen.getByLabelText("kcal"), "750");
    await user.click(screen.getByRole("button", { name: "Noter" }));

    expect(screen.getByTestId("journal-error")).toHaveTextContent("au moins un nom");
    expect(logMeal).not.toHaveBeenCalled();
  });

  it("keeps the charts and the target behind the plan, and says which", () => {
    renderJournal();

    expect(screen.queryByTestId("charts")).not.toBeInTheDocument();
    expect(screen.queryByTestId("targets")).not.toBeInTheDocument();
    const locked = screen.getByTestId("tracking-locked");
    // The diary is not what is being sold, and the panel says so.
    expect(locked).toHaveTextContent("Le journal reste gratuit");
    expect(locked).toHaveTextContent("n'est pas encore ouvert à la souscription");
  });

  it("draws the week, the findings and the target once the plan is paid for", () => {
    renderJournal(
      weekWith({
        tracking: true,
        targets: { kcal: 2000, proteinG: 100, carbsG: 250, fatG: 70, chosen: true },
        insights: [
          { code: "PARTIAL_WEEK", values: { logged: 1, days: 7 } },
          {
            code: "ENERGY_VS_TARGET",
            values: { average: 1800, target: 2000, gap: -200, gapPercent: -10 },
          },
        ],
      }),
    );

    expect(screen.getByTestId("charts")).toBeInTheDocument();
    const insights = screen.getByTestId("insights");
    expect(insights).toHaveTextContent("1 jours notés sur 7");
    expect(insights).toHaveTextContent("1800 kcal en moyenne");
    // Every finding carries something to do about it.
    expect(insights).toHaveTextContent("Les moyennes portent sur ces jours-là");
    // And nothing that praises, blames or counts a streak.
    expect(insights).not.toHaveTextContent(/bravo|félicitations|série/i);
  });

  it("draws a bar for a day that was written down and none for a day that was not", () => {
    renderJournal(
      weekWith({
        tracking: true,
        targets: { kcal: 2000, proteinG: 100, carbsG: 250, fatG: 70, chosen: true },
      }),
    );

    // Monday was logged; Tuesday was not, and an empty day is not a zero.
    expect(screen.getAllByTestId(`bar-${MONDAY}`).length).toBeGreaterThan(0);
    expect(screen.queryByTestId("bar-2026-03-03")).not.toBeInTheDocument();
  });

  it("says the average is over the days that were written down", () => {
    renderJournal();
    expect(screen.getByTestId("logged-days")).toHaveTextContent("1");
  });

  it("shows the free plan's window as a smaller answer, not a refusal", async () => {
    const user = userEvent.setup();
    history.mockResolvedValueOnce({
      from: "2026-02-01",
      to: MONDAY,
      windowed: true,
      windowDays: 30,
      earliest: "2025-11-02",
      days: [day("2026-02-01", 2000)],
    });
    renderJournal();

    await user.click(screen.getByRole("button", { name: "Voir les 90 derniers jours" }));

    const notice = await screen.findByTestId("history-windowed");
    expect(notice).toHaveTextContent("fenêtre de 30 jours");
    // Nothing is deleted, and the panel says what brings it back.
    expect(notice).toHaveTextContent("Rien n'est supprimé");
  });

  it("removes an entry", async () => {
    const user = userEvent.setup();
    renderJournal();

    await user.click(
      within(screen.getByTestId("entries")).getByRole("button", {
        name: "Retirer Pizza chez Luigi du journal",
      }),
    );

    await waitFor(() => expect(removeEntry).toHaveBeenCalledWith(1));
  });

  it("puts a deleted entry back, with the figures it had", async () => {
    const user = userEvent.setup();
    renderJournal();

    await user.click(
      within(screen.getByTestId("entries")).getByRole("button", {
        name: "Retirer Pizza chez Luigi du journal",
      }),
    );

    // No confirmation on the way out; a way back afterwards instead.
    const notice = await screen.findByTestId("entry-removed");
    expect(notice).toHaveTextContent("Pizza chez Luigi");

    await user.click(screen.getByTestId("undo-remove"));

    await waitFor(() =>
      expect(restoreEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Pizza chez Luigi",
          date: MONDAY,
          slot: "DINNER",
          // The figures travel: a restore that recomputed from the recipe
          // would give back a different meal than the one deleted.
          kcal: 1800,
          proteinG: 30,
          source: "FREE",
        }),
      ),
    );
    expect(screen.queryByTestId("entry-removed")).not.toBeInTheDocument();
  });

  it("sets a target, which is the paid half", async () => {
    const user = userEvent.setup();
    renderJournal(
      weekWith({
        tracking: true,
        targets: { kcal: 2000, proteinG: 100, carbsG: 250, fatG: 70, chosen: false },
      }),
    );

    // Said plainly: figures nobody chose are suggestions.
    expect(screen.getByTestId("targets")).toHaveTextContent("ce sont des suggestions");

    await user.clear(screen.getByLabelText("kcal / jour"));
    await user.type(screen.getByLabelText("kcal / jour"), "2200");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() =>
      expect(setTargets).toHaveBeenCalledWith(
        expect.objectContaining({ kcal: 2200 }),
      ),
    );
  });
});
