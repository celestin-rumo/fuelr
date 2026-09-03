import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@app/test/render";
import type { PantryItem, ShoppingItem, ShoppingListView } from "@app/lib/api";
import { readQueue } from "@app/lib/shopping-offline";
import { ShoppingList } from "./shopping-list";

const refresh = vi.fn();
/**
 * One object, as Next's own router is. Returning a fresh one per call makes
 * every effect that depends on it re-run on every render — which is not what
 * the component meets in a browser.
 */
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

const checkItem = vi.fn(async () => ({}) as ShoppingListView);
const addItem = vi.fn(async () => ({ ok: true }));
const removeItem = vi.fn(async () => ({ ok: true }));
const syncTicks = vi.fn(async () => ({}) as ShoppingListView);
const stockItem = vi.fn(async () => ({ ok: true }) as { ok: true; item: PantryItem });
const unstockItem = vi.fn(async () => ({ ok: true }));

vi.mock("@app/[locale]/(app)/app/shopping/actions", () => ({
  checkItem: (...args: unknown[]) => checkItem(...(args as [])),
  addItem: (...args: unknown[]) => addItem(...(args as [])),
  removeItem: (...args: unknown[]) => removeItem(...(args as [])),
  syncTicks: (...args: unknown[]) => syncTicks(...(args as [])),
  stockItem: (...args: unknown[]) => stockItem(...(args as [])),
  unstockItem: (...args: unknown[]) => unstockItem(...(args as [])),
}));

function itemWith(overrides: Partial<ShoppingItem> = {}): ShoppingItem {
  return {
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
    ...overrides,
  };
}

function listWith(overrides: Partial<ShoppingListView> = {}): ShoppingListView {
  return {
    id: 1,
    weekStart: "2026-03-02",
    generatedAt: "2026-03-02T10:00:00Z",
    aisles: [
      { aisle: "PRODUCE", items: [itemWith({ id: 9, name: "Tomate", quantity: 300 })] },
      { aisle: "GROCERY", items: [itemWith()] },
    ],
    covered: [],
    remaining: 2,
    ...overrides,
  };
}

function renderList(list = listWith(), pantry: PantryItem[] = []) {
  return renderWithIntl(
    <ShoppingList list={list} pantry={pantry} week="2026-03-02" />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ShoppingList", () => {
  it("groups the lines by aisle, in the order a shop is walked", () => {
    renderList();

    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings[0]).toHaveTextContent("Fruits & légumes");
    expect(headings[1]).toHaveTextContent("Épicerie");
  });

  it("says how much is left to pick up", () => {
    renderList();
    expect(screen.getByTestId("remaining")).toHaveTextContent("2 articles restants");
  });

  it("ticks a line, carrying the instant it happened", async () => {
    const user = userEvent.setup();
    renderList();

    await user.click(screen.getByTestId("item-10"));

    await waitFor(() => expect(checkItem).toHaveBeenCalled());
    const [id, checked, at] = checkItem.mock.calls[0] as unknown as [number, boolean, string];
    expect(id).toBe(10);
    expect(checked).toBe(true);
    // The shop, not the sync: the server keeps whichever tick happened last.
    expect(Date.parse(at)).toBeGreaterThan(0);
  });

  it("keeps a ticked line on the list, struck through", () => {
    renderList(
      listWith({
        aisles: [{ aisle: "GROCERY", items: [itemWith({ checked: true })] }],
        remaining: 0,
      }),
    );

    const item = screen.getByTestId("item-10");
    expect(item).toBeChecked();
    // Still there — it is the record of the trip, not a disappearing act.
    expect(screen.getByText("Lentilles")).toHaveClass("line-through");
  });

  it("keeps a tick the server refused, and says it has not been sent", async () => {
    const user = userEvent.setup();
    checkItem.mockRejectedValueOnce(new Error("offline"));
    renderList();

    await user.click(screen.getByTestId("item-10"));

    // Not "you are offline", which is a guess — "this has not been saved".
    expect(await screen.findByTestId("pending-ticks")).toHaveTextContent(
      "n'est pas encore enregistrée",
    );
    expect(readQueue()).toEqual([
      expect.objectContaining({ id: 10, checked: true }),
    ]);
  });

  it("adds a free item with no recipe behind it", async () => {
    const user = userEvent.setup();
    renderList();

    await user.type(screen.getByLabelText("Article"), "Papier toilette");
    await user.click(screen.getByRole("button", { name: "Ajouter" }));

    await waitFor(() =>
      expect(addItem).toHaveBeenCalledWith("2026-03-02", {
        name: "Papier toilette",
        quantity: undefined,
      }),
    );
  });

  it("offers to remove a free item, and never a line from the plan", async () => {
    const user = userEvent.setup();
    renderList(
      listWith({
        aisles: [
          {
            aisle: "HOUSEHOLD",
            items: [
              itemWith({ id: 20, name: "Papier toilette", source: "MANUAL", quantity: null, toBuy: null }),
              itemWith({ id: 21, name: "Lentilles", source: "PLAN" }),
            ],
          },
        ],
      }),
    );

    expect(
      screen.queryByRole("button", { name: "Retirer Lentilles de la liste" }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Retirer Papier toilette de la liste" }),
    );
    await waitFor(() => expect(removeItem).toHaveBeenCalledWith(20));

    // Removed by mistake, put back as a line rather than as an apology.
    const notice = await screen.findByTestId("item-removed");
    expect(notice).toHaveTextContent("Papier toilette");

    await user.click(screen.getByTestId("undo-remove"));
    await waitFor(() =>
      expect(addItem).toHaveBeenCalledWith("2026-03-02", {
        name: "Papier toilette",
        quantity: undefined,
        unit: "g",
      }),
    );
  });

  it("shows what the cupboard already covers rather than hiding it", () => {
    renderList(
      listWith({
        covered: [itemWith({ id: 30, name: "Riz", quantity: 200, toBuy: 0, inStock: 500 })],
      }),
    );

    const covered = screen.getByTestId("covered");
    expect(covered).toHaveTextContent("Déjà au placard");
    expect(within(covered).getByText("Riz")).toBeInTheDocument();
  });

  it("shows what is left to buy, not what the week needs, when some is at home", () => {
    renderList(
      listWith({
        aisles: [
          { aisle: "GROCERY", items: [itemWith({ quantity: 400, inStock: 100, toBuy: 300 })] },
        ],
        remaining: 1,
      }),
    );

    expect(screen.getByTestId("item-10").closest("li")).toHaveTextContent("300 g");
    expect(screen.getByTestId("item-10").closest("li")).toHaveTextContent(
      "100 g au placard",
    );
  });

  it("puts something in the cupboard", async () => {
    const user = userEvent.setup();
    renderList();

    await user.type(screen.getByLabelText("Ingrédient"), "Riz");
    await user.type(screen.getByLabelText("Quantité (g)"), "500");
    await user.click(screen.getByRole("button", { name: "Mettre au placard" }));

    await waitFor(() =>
      expect(stockItem).toHaveBeenCalledWith({ name: "Riz", quantity: 500, unit: "g" }),
    );
  });

  it("hides everything that needs a server when it is rendered offline", () => {
    renderWithIntl(
      <ShoppingList list={listWith()} pantry={[]} week="2026-03-02" offline />,
    );

    // The list is readable and tickable; nothing else pretends to work.
    expect(screen.getByTestId("item-10")).toBeInTheDocument();
    expect(screen.queryByLabelText("Article")).not.toBeInTheDocument();
    expect(screen.queryByTestId("pantry")).not.toBeInTheDocument();
  });

  it("queues a tick made offline without ever calling the server", async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <ShoppingList list={listWith()} pantry={[]} week="2026-03-02" offline />,
    );

    await user.click(screen.getByTestId("item-10"));

    expect(checkItem).not.toHaveBeenCalled();
    expect(readQueue()).toEqual([expect.objectContaining({ id: 10, checked: true })]);
  });
});
