"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "./cn";
import { Icon, type IconName } from "./icon";

export type ToastVariant = "success" | "error" | "info";

export interface ToastOptions {
  /** Milliseconds before auto-dismiss; 0 keeps the toast until dismissed. */
  duration?: number;
}

export interface ToastApi {
  /** Returns the toast id (usable with dismiss). */
  show: (message: string, variant?: ToastVariant, options?: ToastOptions) => string;
  success: (message: string, options?: ToastOptions) => string;
  error: (message: string, options?: ToastOptions) => string;
  info: (message: string, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
}

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) {
    throw new Error("useToast must be used inside <ToastProvider>.");
  }
  return api;
}

/* Dark slate chips with a leading status icon (no accent left-rail). */
const toastIcon: Record<ToastVariant, { name: IconName; tint: string }> = {
  success: { name: "success", tint: "text-emerald-400" },
  error: { name: "alert", tint: "text-red-400" },
  info: { name: "info", tint: "text-sky-400" },
};

export interface ToastProviderProps {
  children: ReactNode;
  /** Default auto-dismiss in ms. Defaults to 4200 (prototype timing). */
  duration?: number;
}

export function ToastProvider({ children, duration = 4200 }: ToastProviderProps) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const show = useCallback(
    (message: string, variant: ToastVariant = "info", options?: ToastOptions) => {
      counter.current += 1;
      const id = `toast-${counter.current}`;
      setItems((prev) => [...prev, { id, message, variant }]);
      const ms = options?.duration ?? duration;
      if (ms > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), ms),
        );
      }
      return id;
    },
    [dismiss, duration],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((timer) => clearTimeout(timer));
      map.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (message, options) => show(message, "success", options),
      error: (message, options) => show(message, "error", options),
      info: (message, options) => show(message, "info", options),
      dismiss,
    }),
    [show, dismiss],
  );

  return (
    <ToastContext value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed right-5 bottom-5 z-[500] flex w-[340px] max-w-[calc(100vw-2.5rem)] flex-col items-end gap-2"
      >
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className="pointer-events-auto flex w-full animate-toast-in items-start gap-2.5 rounded-[10px] bg-sidebar px-4 py-2.5 text-[13px] leading-snug text-white shadow-overlay"
          >
            <Icon
              name={toastIcon[item.variant].name}
              size={16}
              className={cn("mt-0.5 shrink-0", toastIcon[item.variant].tint)}
            />
            <span className="flex-1 py-0.5">{item.message}</span>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label="Dismiss notification"
              className="mt-0.5 grid size-5 shrink-0 place-items-center rounded text-slate-400 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-primary-soft"
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext>
  );
}
