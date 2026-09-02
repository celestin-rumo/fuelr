import { beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";

/**
 * jsdom keeps one `localStorage` for a whole test file, so anything a
 * component stores — an onboarding draft, a cooking session — is still there
 * for the next test, which then starts from somebody else's state. The order
 * of the tests decides whether they pass, and the failure reads as a bug in
 * the component.
 */
beforeEach(() => {
  try {
    window.localStorage.clear();
  } catch {
    // A test that deliberately breaks storage. Nothing to clear.
  }
});
