import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

/**
 * False on the server and through hydration, true afterwards.
 *
 * Anything held on the device — an onboarding draft, a cooking session — only
 * exists in the browser, so a component that reads it cannot render the same
 * markup on both sides. Rather than reading storage in an effect and patching
 * the result in, which is both a state update in an effect and a hydration
 * mismatch, the stateful part waits for this and can then seed itself straight
 * from storage.
 */
export function useHydrated() {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
}
