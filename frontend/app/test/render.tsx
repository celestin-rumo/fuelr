import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import common from "../messages/fr/common.json";
import site from "../messages/fr/site.json";

const messages = { ...common, site };

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="fr" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

/**
 * Renders with the real French catalogue rather than stub strings, so a test
 * fails when a message key is renamed or dropped.
 */
export function renderWithIntl(ui: ReactElement) {
  return render(ui, { wrapper: Wrapper });
}
