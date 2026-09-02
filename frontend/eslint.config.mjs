import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    // The e2e run builds here instead, to keep out of the dev server's way.
    ".next-e2e/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Test artefacts: Playwright's HTML report bundles minified vendor code
    // that lints as thousands of false positives.
    "playwright-report/**",
    "test-results/**",
    "coverage/**",
  ]),
]);

export default eslintConfig;
