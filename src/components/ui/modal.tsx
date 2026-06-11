"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  open: boolean;
  /** Called on Escape, backdrop click, and the close button. */
  onClose: () => void;
  /** Required — it labels the dialog for assistive tech. */
  title: ReactNode;
  children: ReactNode;
  /** Action row, e.g. ghost Cancel + primary confirm. */
  footer?: ReactNode;
  /** md = 640px (default), lg = 860px. */
  size?: "md" | "lg";
  /** Set false for destructive confirmations that must be answered. */
  closeOnBackdrop?: boolean;
}

/**
 * Portal dialog: focus is trapped while open, restored on close; Escape and
 * backdrop click dismiss; body scroll is locked.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  closeOnBackdrop = true,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const pressedBackdrop = useRef(false);
  const titleId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const first = panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (first ?? panel).focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex animate-fade-in items-start justify-center overflow-y-auto bg-sidebar/55 px-4 py-10"
      onMouseDown={(event) => {
        pressedBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (closeOnBackdrop && pressedBackdrop.current && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "w-full animate-modal-in rounded-modal bg-surface shadow-overlay outline-none",
          size === "lg" ? "max-w-[860px]" : "max-w-[640px]",
        )}
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <h3 id={titleId} className="text-base font-semibold text-ink">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="grid size-7 shrink-0 place-items-center rounded-md text-slate-400 outline-none transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-[3px] focus-visible:ring-primary-soft"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto px-5 py-5 scrollbar-slim">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 px-5 py-3.5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
