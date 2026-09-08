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

/** The stream, stood in for: (url, body, onProgress) → the answer. */
const askLive = vi.fn();
vi.mock("@app/lib/ideas-stream", () => ({
  askLive: (...args: unknown[]) => askLive(...(args as [])),
}));

const acceptProposal = vi.fn<(proposal: WeekProposal) => Promise<{ ok: boolean }>>(
  async () => ({ ok: true }),
);

vi.mock("@app/[locale]/(app)/app/plan/actions", () => ({
  acceptProposal: (...args: unknown[]) => acceptProposal(...(args as [WeekProposal])),
}));

const MONDAY = "2026-03-02";
const TUESDAY = "2026-03-03";

function proposal(overrides: Partial<WeekProposal> = {}): WeekProposal {
  const title = overrides.title ?? "Risotto";
  return {
    date: MONDAY,
    slot: "DINNER",
    title,
    minutes: 35,
    // Every dish here is one nobody has written yet, so every one of them
    // carries what it takes to become a draft.
    idea: { title, minutes: 35, ingredients: [], steps: ["Cuire."] },
    ...overrides,
  };
}

function answer(proposals: WeekProposal[], rest: Partial<WeekSuggestion> = {}) {
  return {
    ok: true as const,
    result: { proposals, unfilled: 0, declined: "NONE" as const, ...rest },
  };
}

/** The whole first screen, up to the proposals being on show. */
async function askFor(proposals: WeekProposal[], rest: Partial<WeekSuggestion> = {}) {
  const user = userEvent.setup({ delay: null });
  askLive.mockResolvedValueOnce(answer(proposals, rest));
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
  askLive.mockResolvedValueOnce(answer([proposal()]));
  renderWithIntl(<WeekSuggest weekStart={MONDAY} planned={[`${TUESDAY}:DINNER`]} />);

  await user.click(screen.getByTestId("suggest-week"));
  await user.click(screen.getByRole("button", { name: "Végétarien" }));
  await user.click(screen.getByRole("button", { name: "Italienne" }));
  await user.click(screen.getByRole("button", { name: "Proposer une semaine" }));

  await waitFor(() => expect(askLive).toHaveBeenCalledTimes(1));
  expect(askLive.mock.calls[0][1]).toMatchObject({
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
    proposal({ date: TUESDAY, title: "Minestrone" }),
  ]);

  await user.click(screen.getByTestId(`refuse-${MONDAY}-DINNER`));
  await user.click(screen.getByRole("button", { name: "Pas envie" }));

  askLive.mockResolvedValueOnce(answer([proposal({ title: "Pâtes au pesto" })]));
  await user.click(screen.getByTestId("reask"));

  await waitFor(() => expect(askLive).toHaveBeenCalledTimes(2));
  const second = askLive.mock.calls[1][1];
  // Tuesday was kept, so it is not asked about a second time…
  expect(second.keep).toContainEqual({ date: TUESDAY, slot: "DINNER" });
  // …and neither dish can come back: a name is the only handle there is.
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

  askLive.mockResolvedValueOnce(answer([proposal({ title: "Salade" })]));
  await user.click(screen.getByTestId("reask"));

  // "Trop long" is the only reason that names something the library can search
  // on. The rest are exclusions, and the ask is unchanged by them.
  await waitFor(() => expect(askLive).toHaveBeenCalledTimes(2));
  expect(askLive.mock.calls[1][1].intents).toEqual(["quick"]);
});

it("sends what was typed, and only when something was refused", async () => {
  const user = await askFor([proposal()]);

  expect(screen.queryByLabelText("Autre chose à préciser ?")).not.toBeInTheDocument();

  await user.click(screen.getByTestId(`refuse-${MONDAY}-DINNER`));
  await user.click(screen.getByRole("button", { name: "Trop souvent" }));
  await user.type(screen.getByLabelText("Autre chose à préciser ?"), "moins de pâtes");

  askLive.mockResolvedValueOnce(answer([proposal({ title: "Salade" })]));
  await user.click(screen.getByTestId("reask"));

  await waitFor(() => expect(askLive).toHaveBeenCalledTimes(2));
  expect(askLive.mock.calls[1][1].note).toBe("moins de pâtes");
});

it("adds only what was kept, then offers the shopping list", async () => {
  const user = await askFor([
    proposal(),
    proposal({ date: TUESDAY, title: "Minestrone" }),
  ]);

  await user.click(screen.getByTestId(`refuse-${MONDAY}-DINNER`));
  await user.click(screen.getByRole("button", { name: "Pas envie" }));
  await user.click(screen.getByRole("button", { name: /Garder seulement/ }));

  await waitFor(() => expect(acceptProposal).toHaveBeenCalledTimes(1));
  expect(acceptProposal.mock.calls[0][0]).toMatchObject({ title: "Minestrone" });

  // One press from an accepted week to what there is to buy.
  expect(await screen.findByTestId("to-shopping")).toBeInTheDocument();
});

it("never dresses an invented dish as a recipe somebody wrote", async () => {
  await askFor([proposal({ title: "Poke bowl" })], { unfilled: 2 });

  const row = screen.getByTestId(`proposal-${MONDAY}-DINNER`);
  expect(within(row).getByText("Nouveau plat")).toBeInTheDocument();
  // Slots nothing came back for are an answer, not a failure.
  expect(screen.getByText(/2 repas sans proposition/)).toBeInTheDocument();
});

it("names the refusal instead of quietly returning less", async () => {
  // There is no library to fall back on any more, so a screen that declined
  // without saying which refusal it is would teach somebody to stop pressing.
  await askFor([], { declined: "BUDGET", unfilled: 7 });

  expect(screen.getByTestId("declined")).toHaveTextContent(/budget/i);
});

it("stops asking again after a few rounds", async () => {
  const user = await askFor([proposal()]);

  for (let round = 0; round < 3; round += 1) {
    await user.click(screen.getByTestId(`refuse-${MONDAY}-DINNER`));
    await user.click(screen.getByRole("button", { name: "Pas envie" }));
    askLive.mockResolvedValueOnce(
      answer([proposal({ title: `Plat ${round}` + round })]),
    );
    await user.click(screen.getByTestId("reask"));
    await waitFor(() => expect(askLive).toHaveBeenCalledTimes(round + 2));
  }

  await user.click(screen.getByTestId(`refuse-${MONDAY}-DINNER`));
  await user.click(screen.getByRole("button", { name: "Pas envie" }));

  // A loop that cannot end is not a conversation: the way out is offered
  // instead, and it is the honest one — keep what suits you.
  expect(screen.queryByTestId("reask")).not.toBeInTheDocument();
  expect(screen.getByText(/Assez d'essais/)).toBeInTheDocument();
});

it("counts the dishes as their titles close, and shows the one being written", async () => {
  const user = userEvent.setup({ delay: null });
  let finish!: (answer: unknown) => void;
  askLive.mockImplementationOnce(
    (_url: string, _body: unknown, onProgress: (progress: unknown) => void) =>
      new Promise((resolve) => {
        onProgress({ done: 2, of: 5, title: "Dahl de lentilles" });
        finish = resolve;
      }),
  );
  renderWithIntl(<WeekSuggest weekStart={MONDAY} planned={[]} />);
  await user.click(screen.getByTestId("suggest-week"));
  await user.click(screen.getByRole("button", { name: "Proposer une semaine" }));

  // Real, from the stream: never a clock dressed as a percentage.
  const bar = await screen.findByRole("progressbar");
  expect(bar).toHaveAttribute("aria-valuenow", "2");
  expect(bar).toHaveAttribute("aria-valuemax", "5");
  expect(screen.getByTestId("working")).toHaveTextContent("Plat 2 sur 5");
  expect(screen.getByTestId("working-title")).toHaveTextContent("Dahl de lentilles");
  // The dish being written decides the picture: a dahl is a bowl.
  expect(screen.getByTestId("working").querySelector('[data-food="bowl"]')).not.toBeNull();

  finish(answer([proposal({ title: "Dahl de lentilles" })]));
  await screen.findByTestId("proposals");
  expect(screen.queryByRole("progressbar")).toBeNull();
});

it("shows each dish the moment it is written, before the answer is whole", async () => {
  const user = userEvent.setup({ delay: null });
  let finish!: (answer: unknown) => void;
  askLive.mockImplementationOnce(
    (
      _url: string,
      _body: unknown,
      onProgress: (progress: unknown) => void,
      onDish: (arrival: unknown) => void,
    ) =>
      new Promise((resolve) => {
        onProgress({ done: 1, of: 3, title: "Dahl de lentilles" });
        onDish({ index: 1, of: 3, dish: proposal({ title: "Dahl de lentilles" }) });
        finish = resolve;
      }),
  );
  renderWithIntl(<WeekSuggest weekStart={MONDAY} planned={[]} />);
  await user.click(screen.getByTestId("suggest-week"));
  await user.click(screen.getByRole("button", { name: "Proposer une semaine" }));

  const arriving = await screen.findByTestId("arriving");
  expect(arriving).toHaveTextContent("1 plat prêt");
  expect(within(arriving).getByTestId("arriving-proposal")).toHaveTextContent("Dahl de lentilles");
  // Not yet a decision: the reviewed list comes with the whole answer.
  expect(screen.queryByTestId("proposals")).toBeNull();

  finish(answer([proposal({ title: "Dahl de lentilles" })]));
  await screen.findByTestId("proposals");
  expect(screen.queryByTestId("arriving")).toBeNull();
});
