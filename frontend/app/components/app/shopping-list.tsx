"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Banner } from "@ui/banner";
import { Button, buttonClasses } from "@ui/button";
import { Card, CardTitle } from "@ui/card";
import { Checkbox } from "@ui/checkbox";
import { Input } from "@ui/input";
import { cn } from "@ui/cn";
import type { PantryItem, ShoppingItem, ShoppingListView } from "@app/lib/api";
import { addDays, formatDay } from "@app/lib/week";
import {
  clearQueue,
  queueTick,
  readQueue,
  saveList,
  syncedAt,
  withQueue,
} from "@app/lib/shopping-offline";
import {
  addItem,
  checkItem,
  removeItem,
  stockItem,
  syncTicks,
  unstockItem,
} from "@app/[locale]/(app)/app/shopping/actions";

/**
 * The list, in a shop, with or without a network.
 *
 * Nothing here asks whether the network is there. Every tick is attempted
 * against the server and whatever fails is kept on the device until it can be
 * sent — a failed request is a fact, and `navigator.onLine` is a guess that
 * says "online" in a basement where nothing answers.
 */
export function ShoppingList({
  list,
  pantry,
  week,
  offline = false,
}: {
  list: ShoppingListView;
  pantry: PantryItem[];
  week: string;
  /** Rendered from the copy on the device, with no server behind it. */
  offline?: boolean;
}) {
  const t = useTranslations("shopping");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [queue, setQueue] = useState(readQueue);
  const [error, setError] = useState<string | null>(null);
  // The last hand-added line deleted, kept until the banner is answered.
  const [removed, setRemoved] = useState<ShoppingItem | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [stockName, setStockName] = useState("");
  const [stockAmount, setStockAmount] = useState("");
  /** One flush at a time, whatever makes it run. */
  const flushing = useRef(false);

  const shown = withQueue(list, queue);

  // Keep a copy on the device for the aisle with no signal. Writing it in an
  // effect rather than during render because it touches a browser API, and
  // only when the server's version changes.
  useEffect(() => {
    if (!offline) saveList(week, list);
  }, [offline, week, list]);

  /**
   * Sends whatever was ticked with no network. Runs on mount and whenever the
   * browser says the network is back — that event is a decent hint, and the
   * send failing again is the real answer.
   */
  useEffect(() => {
    if (offline) return;
    let cancelled = false;

    async function flush() {
      const waiting = readQueue();
      if (waiting.length === 0 || flushing.current) return;
      flushing.current = true;
      try {
        await syncTicks(week, waiting);
        if (cancelled) return;
        clearQueue();
        setQueue([]);
        router.refresh();
      } catch {
        // Still unreachable. The ticks stay where they are.
      } finally {
        flushing.current = false;
      }
    }

    void flush();
    window.addEventListener("online", flush);
    return () => {
      cancelled = true;
      window.removeEventListener("online", flush);
    };
  }, [offline, week, router]);

  function tick(item: ShoppingItem, checked: boolean) {
    const at = new Date().toISOString();
    setError(null);
    // Kept before the request either way: the box has to move under the thumb
    // of somebody holding a basket.
    queueTick({ id: item.id, checked, at });
    setQueue(readQueue());

    if (offline) return;
    startTransition(async () => {
      try {
        await checkItem(item.id, checked, at);
        clearQueue();
        setQueue([]);
        router.refresh();
      } catch {
        // No network, or the server said no. It stays queued, and the screen
        // says so rather than pretending it went through.
        setQueue(readQueue());
      }
    });
  }

  function add(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const quantity = amount.trim() === "" ? undefined : Number(amount);
    setError(null);
    startTransition(async () => {
      const result = await addItem(week, {
        name: trimmed,
        quantity: Number.isFinite(quantity) ? quantity : undefined,
      });
      if (!result.ok) {
        setError(t("errors.failed"));
        return;
      }
      setName("");
      setAmount("");
      router.refresh();
    });
  }

  function remove(item: ShoppingItem) {
    startTransition(async () => {
      const result = await removeItem(item.id);
      if (!result.ok) {
        setError(t("errors.planLine"));
        return;
      }
      setRemoved(item);
      router.refresh();
    });
  }

  /*
   * A line removed by mistake comes back as a line, not as an apology. Only
   * hand-added lines can be removed at all — the ones the plan puts there go
   * when the meal does — so putting one back is adding it again, with the
   * quantity it had.
   */
  function undoRemove() {
    const item = removed;
    if (!item) return;
    setRemoved(null);
    startTransition(async () => {
      const result = await addItem(week, {
        name: item.name,
        quantity: item.quantity ?? undefined,
        unit: item.unit,
      });
      if (!result.ok) setError(t("errors.failed"));
      router.refresh();
    });
  }

  function stock(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = stockName.trim();
    const quantity = Number(stockAmount);
    if (!trimmed || !Number.isFinite(quantity) || quantity <= 0) return;
    startTransition(async () => {
      const result = await stockItem({ name: trimmed, quantity, unit: "g" });
      if (!result.ok) {
        setError(t("errors.failed"));
        return;
      }
      setStockName("");
      setStockAmount("");
      router.refresh();
    });
  }

  return (
    <div className={cn("flex flex-col gap-6", pending && "opacity-[0.9]")}>
      {error && (
        <Banner tone="error" data-testid="shopping-error" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}

      {removed && (
        <Banner
          tone="info"
          data-testid="item-removed"
          dismissLabel={t("undoDismiss")}
          onDismiss={() => setRemoved(null)}
          action={
            <Button
              variant="secondary"
              size="sm"
              data-testid="undo-remove"
              onClick={undoRemove}
            >
              {t("undo")}
            </Button>
          }
        >
          {t("removed", { name: removed.name })}
        </Banner>
      )}

      {/* Not "you are offline" — that is a guess. This says what is true: some
          ticks have not been sent yet. */}
      {queue.length > 0 && (
        <Banner tone="info" data-testid="pending-ticks">
          {t("pendingTicks", { count: queue.length })}
        </Banner>
      )}

      {!offline && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <WeekLink week={addDays(week, -7)} label={t("previousWeek")}>
            ←
          </WeekLink>
          <h2 data-testid="shopping-week" className="font-display text-[15px] font-bold text-text">
            {t("week", {
              date: formatDay(week, locale, { day: "numeric", month: "long" }),
            })}
          </h2>
          <WeekLink week={addDays(week, 7)} label={t("nextWeek")}>
            →
          </WeekLink>
          <div className="flex-1" />
          <span data-testid="remaining" className="tnum font-mono text-[13px] text-gray">
            {t("remaining", { count: shown.remaining })}
          </span>
          {/* Its own page: the sheet can be looked at before it is printed. */}
          <Link
            href={{ pathname: "/app/shopping/print", query: { week } }}
            data-testid="print-shopping"
            className={buttonClasses({ variant: "tertiary", size: "sm" })}
          >
            {t("print.button")}
          </Link>
        </div>
      )}


      {shown.aisles.length === 0 && shown.covered.length === 0 ? (
        <p data-testid="shopping-empty" className="text-[15px] font-medium text-text-dim">
          {t("empty")}
        </p>
      ) : (
        <div className="flex flex-col gap-5" data-testid="aisles">
          {shown.aisles.map((group) => (
            <section key={group.aisle}>
              <h3 className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
                {t(`aisles.${group.aisle}`)}
              </h3>
              <ul className="mt-2 flex flex-col divide-y divide-line rounded-md border border-line bg-bg-raised">
                {group.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 px-3">
                    {/* 56px of row, so it can be hit with a knuckle while
                        holding a basket. The label is the target. */}
                    <Checkbox
                      className="min-h-14 flex-1 py-2"
                      checked={item.checked}
                      onChange={(event) => tick(item, event.target.checked)}
                      data-testid={`item-${item.id}`}
                      label={<ItemLabel item={item} />}
                    />
                    {item.source === "MANUAL" && (
                      <Button
                        variant="dangerText"
                        size="sm"
                        aria-label={t("removeItem", { name: item.name })}
                        onClick={() => remove(item)}
                      >
                        ✕
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {shown.covered.length > 0 && (
        <section data-testid="covered">
          <h3 className="text-[11px] font-bold tracking-[0.02em] text-gray uppercase">
            {t("covered")}
          </h3>
          <ul className="mt-2 flex flex-col gap-1">
            {shown.covered.map((item) => (
              <li key={item.id} className="text-[13px] font-semibold text-gray">
                {item.name}
                {item.quantity != null && (
                  <span className="tnum ml-2 font-mono">
                    {item.quantity} {item.unit}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!offline && (
        <>
          <Card as="panel">
            <CardTitle>{t("add.title")}</CardTitle>
            <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={add}>
              <div className="min-w-[12rem] flex-1">
                <Input
                  label={t("add.name")}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="w-28">
                <Input
                  label={t("add.quantity")}
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
              <Button type="submit" loading={pending}>
                {t("add.submit")}
              </Button>
            </form>
          </Card>

          <Card as="panel" data-testid="pantry">
            <CardTitle>{t("pantry.title")}</CardTitle>
            <p className="mt-2 text-[15px] leading-[1.5] font-medium text-text-dim">
              {t("pantry.body")}
            </p>

            {pantry.length > 0 && (
              <ul className="mt-4 flex flex-col gap-2">
                {pantry.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center gap-3 rounded-sm border border-line bg-bg-raised-2 p-3"
                  >
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-text">
                      {item.name}
                    </span>
                    <span className="tnum font-mono text-[13px] text-gray">
                      {item.quantity} {item.unit}
                    </span>
                    <Button
                      variant="dangerText"
                      size="sm"
                      aria-label={t("pantry.remove", { name: item.name })}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await unstockItem(item.id);
                          if (result.ok) router.refresh();
                        })
                      }
                    >
                      ✕
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={stock}>
              <div className="min-w-[12rem] flex-1">
                <Input
                  label={t("pantry.name")}
                  value={stockName}
                  onChange={(event) => setStockName(event.target.value)}
                />
              </div>
              <div className="w-28">
                <Input
                  label={t("pantry.quantity")}
                  inputMode="decimal"
                  value={stockAmount}
                  onChange={(event) => setStockAmount(event.target.value)}
                />
              </div>
              <Button type="submit" variant="secondary" loading={pending}>
                {t("pantry.submit")}
              </Button>
            </form>
          </Card>
        </>
      )}

      {offline && (
        <p className="text-[13px] font-semibold text-gray">
          {t("offlineHint", {
            date: syncedAt(locale),
          })}
        </p>
      )}
    </div>
  );
}

/** Ticked stays visible and struck through: it is a record of the trip. */
function ItemLabel({ item }: { item: ShoppingItem }) {
  const t = useTranslations("shopping");
  const amount = item.toBuy ?? item.quantity;
  return (
    <span className={cn("flex flex-wrap items-baseline gap-2", item.checked && "text-gray")}>
      <span className={cn("text-[15px] font-semibold", item.checked && "line-through")}>
        {item.name}
      </span>
      {amount != null && (
        <span className="tnum font-mono text-[13px] text-gray">
          {amount} {item.unit}
        </span>
      )}
      {item.inStock != null && item.inStock > 0 && (
        <span className="text-[11px] font-semibold text-mint-ink">
          {t("inStock", { quantity: item.inStock, unit: item.unit })}
        </span>
      )}
    </span>
  );
}

function WeekLink({
  week,
  label,
  children,
}: {
  week: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={{ pathname: "/app/shopping", query: { week } }}
      aria-label={label}
      className="grid size-11 place-items-center rounded-full border border-line text-text-dim hover:border-gray hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-ink)]"
    >
      {children}
    </Link>
  );
}
