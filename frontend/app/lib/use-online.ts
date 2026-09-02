import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/**
 * Whether the browser thinks it has a network.
 *
 * True on the server and through hydration, because that is what the markup
 * says — a page that reached the browser was fetched over something. It says
 * nothing about whether the network is any good; it is only ever used to mark
 * a session as offline, never to refuse to do anything.
 */
export function useOnline() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
