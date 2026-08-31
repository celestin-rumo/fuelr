"use client";

import { useState } from "react";
import { cn } from "@ui/cn";

export type FaqItem = { question: string; answer: string };

export function Faq({ items }: { items: FaqItem[] }) {
  // One panel open at a time, matching the artboard; -1 means all closed.
  const [open, setOpen] = useState(0);

  return (
    <div className="divide-y divide-line overflow-hidden rounded-md border border-line bg-bg-raised">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.question}>
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? -1 : i)}
                className={cn(
                  "flex w-full items-center justify-between gap-4 px-6 py-5 text-left",
                  "text-[15px] font-semibold text-text",
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--mint-ink)]",
                  "hover:bg-[color-mix(in_srgb,var(--text)_4%,transparent)]",
                )}
              >
                {item.question}
                <span
                  aria-hidden
                  className="shrink-0 text-lg leading-none text-accent-ink"
                >
                  {isOpen ? "−" : "+"}
                </span>
              </button>
            </h3>
            {isOpen && (
              <p className="max-w-[68ch] px-6 pb-5 text-[15px] leading-[1.6] font-medium text-text-dim">
                {item.answer}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
