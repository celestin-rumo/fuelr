import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

const dirname = import.meta.dirname;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(dirname, "."),
      "@app": path.resolve(dirname, "./app"),
      "@ui": path.resolve(dirname, "./app/components/ui"),
    },
  },
  test: {
    environment: "jsdom",
    server: {
      deps: {
        /**
         * next-intl's navigation helpers import `next/navigation`, a package
         * subpath export. Left external, Node's ESM resolver reads it as a
         * file path and fails — "did you mean next/navigation.js?". Processed
         * by Vite, the export map is honoured. The dev container happened to
         * resolve it anyway, so this only ever failed in CI.
         */
        inline: ["next-intl"],
      },
    },
    /**
     * Fifteen seconds, not five.
     *
     * These are component tests driven through `userEvent`, which types and
     * clicks at a human pace on purpose, and they run several files at a time
     * inside a container. Passing alone and failing in the full run is a
     * scheduler telling you the default was sized for a smaller suite — not a
     * component that got slower.
     */
    testTimeout: 15_000,
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    exclude: ["**/node_modules/**", "**/e2e/**", "**/.next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: "./coverage",
      include: ["app/**/*.{ts,tsx}"],
      exclude: ["app/**/*.test.{ts,tsx}", "**/*.d.ts"],
    },
  },
});
