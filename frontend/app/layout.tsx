import type { ReactNode } from "react";

// The real root layout (<html>/<body>) lives in `app/[locale]/layout.tsx`,
// since the lang attribute depends on the active locale.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
