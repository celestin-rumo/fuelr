import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Menu, type MenuItem } from "./menu";

function open(items: MenuItem[] = [{ label: "Dupliquer", onSelect: vi.fn() }]) {
  render(<Menu label="Autres actions" items={items} />);
  return screen.getByRole("button", { name: "Autres actions" });
}

describe("Menu", () => {
  it("says whether it is open, and hides its items until it is", async () => {
    const trigger = open();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu", { name: "Autres actions" })).toBeInTheDocument();
  });

  it("closes on a choice, because a menu nobody dismissed is in the way", async () => {
    const onSelect = vi.fn();
    const trigger = open([{ label: "Dupliquer", onSelect }]);

    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole("menuitem", { name: "Dupliquer" }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes on Escape and gives focus back to the trigger", async () => {
    // Dropping focus onto the body sends a keyboard user to the top of the
    // page, which is a worse place than where they started.
    const trigger = open();
    await userEvent.click(trigger);
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("keeps an item that does not apply, disabled in place", async () => {
    const onSelect = vi.fn();
    const trigger = open([
      { label: "Monter", onSelect, disabled: true },
      { label: "Supprimer", onSelect: vi.fn() },
    ]);

    await userEvent.click(trigger);
    const item = screen.getByRole("menuitem", { name: "Monter" });
    expect(item).toBeDisabled();
    await userEvent.click(item);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("renders an item that goes somewhere as a link", async () => {
    // So it can be opened in a new tab, and so a download is the browser's
    // navigation rather than a script assigning `location`.
    const trigger = open([
      { label: "Exporter", href: "/api/recipes/export", download: true },
    ]);
    await userEvent.click(trigger);

    const item = screen.getByRole("menuitem", { name: "Exporter" });
    expect(item.tagName).toBe("A");
    expect(item).toHaveAttribute("href", "/api/recipes/export");
    expect(item).toHaveAttribute("download");
  });

  it("falls back to a button when a link would be dead", async () => {
    const trigger = open([
      { label: "Exporter", href: "/api/recipes/export", disabled: true },
    ]);
    await userEvent.click(trigger);

    const item = screen.getByRole("menuitem", { name: "Exporter" });
    expect(item.tagName).toBe("BUTTON");
    expect(item).toBeDisabled();
  });
});
