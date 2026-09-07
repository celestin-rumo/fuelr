import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { renderWithIntl } from "@app/test/render";
import type { BatchMember, BatchSet, Declined } from "@app/lib/api";
import { BatchSuggest } from "./batch-suggest";

const refresh = vi.fn();

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
  Link: ({ children, ...props }: React.ComponentProps<"a"> & { href: unknown }) => (
    <a {...props} href="#">
      {children}
    </a>
  ),
}));

const suggestBatch = vi.fn();
const acceptProposal =
  vi.fn<(proposal: { title: string; date: string }) => Promise<{ ok: boolean }>>(
    async () => ({ ok: true }),
  );

vi.mock("@app/[locale]/(app)/app/plan/actions", () => ({
  suggestBatch: (...args: unknown[]) => suggestBatch(...(args as [])),
  acceptProposal: (...args: unknown[]) =>
    acceptProposal(...(args as [{ title: string; date: string }])),
}));

const MONDAY = "2026-03-02";

function member(title: string, overrides: Partial<BatchMember> = {}): BatchMember {
  return {
    title,
    minutes: 30,
    // Every dish here is one nobody has written yet.
    idea: { title, minutes: 30, ingredients: [], steps: ["Cuire."] },
    ...overrides,
  };
}

function set(overrides: Partial<BatchSet> = {}): BatchSet {
  return {
    members: [member("Dahl"), member("Soupe de lentilles"), member("Salade")],
    bases: [{ name: "Lentilles corail", unit: "g", quantity: 750, dishes: 3 }],
    sharedBy: 3,
    ...overrides,
  };
}

async function askFor(sets: BatchSet[], declined: Declined = "NONE") {
  const user = userEvent.setup({ delay: null });
  suggestBatch.mockResolvedValueOnce({ ok: true, sets: { sets, declined } });
  renderWithIntl(<BatchSuggest weekStart={MONDAY} planned={[]} />);
  await user.click(screen.getByTestId("suggest-batch"));
  await user.click(screen.getByRole("button", { name: "Chercher un ensemble" }));
  await screen.findByTestId("batch-dialog");
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
});

it("asks for a set of the size that was chosen", async () => {
  const user = userEvent.setup({ delay: null });
  suggestBatch.mockResolvedValueOnce({ ok: true, sets: { sets: [set()], declined: "NONE" } });
  renderWithIntl(<BatchSuggest weekStart={MONDAY} planned={[]} />);

  await user.click(screen.getByTestId("suggest-batch"));
  await user.click(screen.getByRole("button", { name: "Un plat de moins" }));
  await user.click(screen.getByRole("button", { name: "Végétarien" }));
  await user.click(screen.getByRole("button", { name: "Chercher un ensemble" }));

  await waitFor(() => expect(suggestBatch).toHaveBeenCalledTimes(1));
  expect(suggestBatch.mock.calls[0][0]).toMatchObject({
    size: 3,
    intents: ["vegetarian"],
    cuisines: [],
  });
});

it("says what a set is a set because of", async () => {
  await askFor([set()]);

  const card = await screen.findByTestId("batch-set-0");
  // Checkable in a second, rather than "these three, trust me".
  expect(within(card).getByText(/3 plats sur 3 sont bâtis sur Lentilles corail/))
    .toBeInTheDocument();
  expect(within(card).getByText(/Lentilles corail — 750 g pour 3 plats/))
    .toBeInTheDocument();
});

it("names the refusal instead of quietly returning nothing", async () => {
  // There is no library to fall back on, so a screen that declined without
  // saying which refusal it is would teach somebody to stop pressing.
  await askFor([], "BUDGET");

  expect(await screen.findByTestId("declined")).toHaveTextContent(/budget/i);
  expect(screen.queryByTestId("batch-sets")).not.toBeInTheDocument();
});

it("says a set that shared nothing after all was dropped", async () => {
  await askFor([], "FAILED");

  expect(await screen.findByTestId("declined")).toHaveTextContent(/rien/i);
});

it("never dresses an invented dish as a recipe somebody wrote", async () => {
  await askFor([set()]);

  const card = await screen.findByTestId("batch-set-0");
  expect(within(card).getAllByText("Nouveau plat")).toHaveLength(3);
});

it("pre-answers which evening, and writes only once asked", async () => {
  const user = await askFor([set()]);

  await user.click(await screen.findByTestId("choose-set-0"));
  await screen.findByTestId("batch-placements");
  // Choosing a set writes nothing: the days are still a question.
  expect(acceptProposal).not.toHaveBeenCalled();

  await user.click(screen.getByTestId("place-batch"));

  await waitFor(() => expect(acceptProposal).toHaveBeenCalledTimes(3));
  // The free dinners of the week, in order.
  expect(acceptProposal.mock.calls[0][0]).toMatchObject({
    date: MONDAY,
    slot: "DINNER",
    title: "Dahl",
  });
  expect(acceptProposal.mock.calls[1][0]).toMatchObject({ date: "2026-03-03" });
});

it("skips the evenings that already hold a meal", async () => {
  const user = userEvent.setup({ delay: null });
  suggestBatch.mockResolvedValueOnce({
    ok: true,
    sets: { sets: [set({ members: [member("Dahl"), member("Soupe")], sharedBy: 2 })], declined: "NONE" },
  });
  renderWithIntl(
    <BatchSuggest weekStart={MONDAY} planned={[`${MONDAY}:DINNER`, "2026-03-03:DINNER"]} />,
  );

  await user.click(screen.getByTestId("suggest-batch"));
  await user.click(screen.getByRole("button", { name: "Chercher un ensemble" }));
  await user.click(await screen.findByTestId("choose-set-0"));
  await user.click(await screen.findByTestId("place-batch"));

  await waitFor(() => expect(acceptProposal).toHaveBeenCalledTimes(2));
  expect(acceptProposal.mock.calls[0][0]).toMatchObject({ date: "2026-03-04" });
  expect(acceptProposal.mock.calls[1][0]).toMatchObject({ date: "2026-03-05" });
});

