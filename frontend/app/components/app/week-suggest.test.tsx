import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { renderWithIntl } from "@app/test/render";
import type { WeekProposal, WeekSuggestion } from "@app/lib/api";
import { WeekSuggest } from "./week-suggest";

const refresh = vi.fn();

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
  Link: ({ children, ...props }: React.ComponentProps<"a"> & { href: unknown }) => (
    <a {...props} href="#">
      {children}
    </a>
  ),
}));

const suggestWeek = vi.fn();
const acceptProposal = vi.fn<(proposal: WeekProposal) => Promise<{ ok: boolean }>>(
  async () => ({ ok: true }),
);

vi.mock("@app/[locale]/(app)/app/plan/actions", () => ({
  suggestWeek: (...args: unknown[]) => suggestWeek(...(args as [])),
  acceptProposal: (...args: unknown[]) => acceptProposal(...(args as [WeekProposal])),
}));

const MONDAY = "2026-03-02";
const TUESDAY = "2026-03-03";

function proposal(overrides: Partial<WeekProposal> = {}): WeekProposal {
  return {
    date: MONDAY,
    slot: "DINNER",
    recipeId: 7,
    title: "Risotto",
    minutes: 35,
    cuisine: "ITALIAN",
    tags: ["vegetarian"],
    hasPhoto: false,
    because: "MATCHED_CUISINE",
    idea: null,
    ...overrides,
  };
}

function answer(proposals: WeekProposal[], rest: Partial<WeekSuggestion> = {}) {
  return {
    ok: true as const,
    suggestion: { proposals, unfilled: 0, assisted: false, ...rest },
  };
}

/** The whole first screen, up to the proposals being on show. */
async function askFor(proposals: WeekProposal[], rest: Partial<WeekSuggestion> = {}) {
  const user = userEvent.setup({ delay: null });
  suggestWeek.mockResolvedValueOnce(answer(proposals, rest));
  renderWithIntl(<WeekSuggest weekStart={MONDAY} planned={[]} />);
  await user.click(screen.getByTestId("suggest-week"));
  await user.click(screen.getByRole("button", { name: "Proposer une semaine" }));
  await screen.findByTestId("proposals");
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
});

it("asks in the direction that was chosen, and writes nothing by asking", async () => {
  const user = userEvent.setup({ delay: null });
  suggestWeek.mockResolvedValueOnce(answer([proposal()]));
  renderWithIntl(<WeekSuggest weekStart={MONDAY} planned={[`${TUESDAY}:DINNER`]} />);

  await user.click(screen.getByTestId("suggest-week"));
  await user.click(screen.getByRole("button", { name: "Végétarien" }));
  await user.click(screen.getByRole("button", { name: "Italienne" }));
  await user.click(screen.getByRole("button", { name: "Proposer une semaine" }));

  await waitFor(() => expect(suggestWeek).toHaveBeenCalledTimes(1));
  expect(suggestWeek.mock.calls[0][0]).toMatchObject({
    week: MONDAY,
    intents: ["vegetarian"],
    cuisines: ["ITALIAN"],
    slots: ["DINNER"],
    // A slot that already holds a meal is not asked about: filling the week
    // must never propose over somebody's Tuesday.
    keep: [{ date: TUESDAY, slot: "DINNER" }],
  });

  // Nothing is on the plan yet, and the screen says so rather than implying it.
  expect(acceptProposal).not.toHaveBeenCalled();
  expect(screen.getByText(/Rien n'est encore au planning/)).toBeInTheDocument();
});

it("keeps what was kept and never proposes a refusal again", async () => {
  const user = await askFor([
    proposal(),
    proposal({ date: TUESDAY, title: "Minestrone", recipeId: 9 }),
  ]);

  await user.click(screen.getByTestId(`refuse-${MONDAY}-DINNER`));
  await user.click(screen.getByRole("button", { name: "Pas envie" }));

  suggestWeek.mockResolvedValueOnce(answer([proposal({ title: "Pâtes au pesto", recipeId: 12 })]));
  await user.click(screen.getByTestId("reask"));

  await waitFor(() => expect(suggestWeek).toHaveBeenCalledTimes(2));
  const second = suggestWeek.mock.calls[1][0];
  // Tuesday was kept, so it is not asked about a second time…
  expect(second.keep).toContainEqual({ date: TUESDAY, slot: "DINNER" });
  // …and neither dish can come back: an idea has no id, so titles carry it.
  expect(second.excludeTitles).toEqual(
    expect.arrayContaining(["Risotto", "Minestrone"]),
  );

  // The kept one is still on screen beside the replacement.
  expect(await screen.findByText("Minestrone")).toBeInTheDocument();
  expect(screen.getByText("Pâtes au pesto")).toBeInTheDocument();
  expect(screen.queryByText("Risotto")).not.toBeInTheDocument();
});

it("acts on the one refusal it can act on", async () => {
  const user = await askFor([proposal()]);

  await user.click(screen.getByTestId(`refuse-${MONDAY}-DINNER`));
  await user.click(screen.getByRole("button", { name: "Trop long" }));

  suggestWeek.mockResolvedValueOnce(answer([proposal({ title: "Salade", recipeId: 3 })]));
  await user.click(screen.getByTestId("reask"));

  // "Trop long" is the only reason that names something the library can search
  // on. The rest are exclusions, and the ask is unchanged by them.
  await waitFor(() => expect(suggestWeek).toHaveBeenCalledTimes(2));
  expect(suggestWeek.mock.calls[1][0].intents).toEqual(["quick"]);
});

it("sends what was typed, and only when something was refused", async () => {
  const user = await askFor([proposal()]);

  expect(screen.queryByLabelText("Autre chose à préciser ?")).not.toBeInTheDocument();

  await user.click(screen.getByTestId(`refuse-${MONDAY}-DINNER`));
  await user.click(screen.getByRole("button", { name: "Trop souvent" }));
  await user.type(screen.getByLabelText("Autre chose à préciser ?"), "moins de pâtes");

  suggestWeek.mockResolvedValueOnce(answer([proposal({ title: "Salade", recipeId: 3 })]));
  await user.click(screen.getByTestId("reask"));

  await waitFor(() => expect(suggestWeek).toHaveBeenCalledTimes(2));
  expect(suggestWeek.mock.calls[1][0].note).toBe("moins de pâtes");
});

it("adds only what was kept, then offers the shopping list", async () => {
  const user = await askFor([
    proposal(),
    proposal({ date: TUESDAY, title: "Minestrone", recipeId: 9 }),
  ]);

  await user.click(screen.getByTestId(`refuse-${MONDAY}-DINNER`));
  await user.click(screen.getByRole("button", { name: "Pas envie" }));
  await user.click(screen.getByRole("button", { name: /Garder seulement/ }));

  await waitFor(() => expect(acceptProposal).toHaveBeenCalledTimes(1));
  expect(acceptProposal.mock.calls[0][0]).toMatchObject({ title: "Minestrone" });

  // One press from an accepted week to what there is to buy.
  expect(await screen.findByTestId("to-shopping")).toBeInTheDocument();
});

it("says out loud when the answer did not come from the library", async () => {
  await askFor([proposal({ because: "IDEA", recipeId: null, title: "Poke bowl" })], {
    assisted: true,
    unfilled: 2,
  });

  expect(screen.getByText(/les idées viennent d'un modèle/)).toBeInTheDocument();
  // An idea is never dressed as a recipe somebody wrote.
  const row = screen.getByTestId(`proposal-${MONDAY}-DINNER`);
  expect(within(row).getByText("Idée à écrire")).toBeInTheDocument();
  // Slots nothing was found for are an answer, not a failure.
  expect(screen.getByText(/2 repas sans proposition/)).toBeInTheDocument();
});

it("stops asking again after a few rounds", async () => {
  const user = await askFor([proposal()]);

  for (let round = 0; round < 3; round += 1) {
    await user.click(screen.getByTestId(`refuse-${MONDAY}-DINNER`));
    await user.click(screen.getByRole("button", { name: "Pas envie" }));
    suggestWeek.mockResolvedValueOnce(
      answer([proposal({ title: `Plat ${round}`, recipeId: 100 + round })]),
    );
    await user.click(screen.getByTestId("reask"));
    await waitFor(() => expect(suggestWeek).toHaveBeenCalledTimes(round + 2));
  }

  await user.click(screen.getByTestId(`refuse-${MONDAY}-DINNER`));
  await user.click(screen.getByRole("button", { name: "Pas envie" }));

  // A loop that cannot end is not a conversation: the way out is offered
  // instead, and it is the honest one — keep what suits you.
  expect(screen.queryByTestId("reask")).not.toBeInTheDocument();
  expect(screen.getByText(/Assez d'essais/)).toBeInTheDocument();
});
