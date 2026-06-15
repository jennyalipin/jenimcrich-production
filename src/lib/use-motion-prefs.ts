import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * True once mounted on the client (false during SSR / first paint). Used to
 * defer client-only renderers (e.g. Lottie) past hydration without a setState
 * effect.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/** The user's `prefers-reduced-motion` preference, SSR-safe and reactive. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}
