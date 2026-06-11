"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";

/**
 * Dark topbar: page title (derived from the route, overridable via `title`),
 * global search (UI only), notifications bell with dropdown, user menu.
 * Sits on the same #0f172a surface as the Sidebar — one continuous frame.
 */

/* ---------- Page titles (mirrors the prototype's `titles` map) ---------- */

type TitleRule = { prefix: string; section: string; detail?: string };

// Order matters: first prefix match wins. Detail title applies one level deeper.
const TITLE_RULES: TitleRule[] = [
  { prefix: "/dashboard", section: "Dashboard" },
  { prefix: "/candidates", section: "Candidates", detail: "Candidate Profile" },
  { prefix: "/pipeline", section: "Hiring Pipeline" },
  { prefix: "/matchmaker", section: "Candidate Matchmaker" },
  { prefix: "/jobs", section: "Job Listings", detail: "Job Details" },
  { prefix: "/calendar", section: "Interview Calendar" },
  { prefix: "/templates", section: "Email Templates" },
  { prefix: "/analytics", section: "Analytics & Reports" },
  { prefix: "/settings", section: "Settings" },
];

export function pageTitleFor(pathname: string): string {
  for (const rule of TITLE_RULES) {
    if (pathname === rule.prefix) return rule.section;
    if (pathname.startsWith(`${rule.prefix}/`)) return rule.detail ?? rule.section;
  }
  return "JeniMcRich";
}

/* ---------- Small helpers ---------- */

/** Dropdown open-state with Escape + outside-click dismissal. */
function useDropdown(): {
  open: boolean;
  setOpen: (open: boolean) => void;
  ref: RefObject<HTMLDivElement | null>;
} {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return { open, setOpen, ref };
}

function TopSvg({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-[18px] w-[18px]"}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const POPOVER_CLASSES =
  "absolute right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-xl";

/* ---------- Notifications (demo content until the data layer lands) ---------- */

type DemoNotification = {
  id: string;
  kind: "stalled" | "interview";
  title: string;
  detail: string;
};

const DEMO_NOTIFICATIONS: DemoNotification[] = [
  {
    id: "n1",
    kind: "stalled",
    title: "Marcus Webb is stalled in Screening",
    detail: "6 days with no activity — follow up or snooze",
  },
  {
    id: "n2",
    kind: "stalled",
    title: "Elena Garcia is stalled in Interview",
    detail: "8 days with no activity — follow up or snooze",
  },
  {
    id: "n3",
    kind: "interview",
    title: "Interview today, 2:00 PM",
    detail: "David Chen — Plant Manager, Lehigh Cement",
  },
];

function NotificationsBell() {
  const { open, setOpen, ref } = useDropdown();
  const [seen, setSeen] = useState(false);
  const unread = seen ? 0 : DEMO_NOTIFICATIONS.length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          setSeen(true);
        }}
        className="relative grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-slate-300 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-emerald-400"
      >
        <TopSvg>
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </TopSvg>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className={`${POPOVER_CLASSES} w-80`}>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <span className="text-[13px] font-semibold text-slate-900">Notifications</span>
            <span className="text-[11px] font-medium text-slate-400">
              {DEMO_NOTIFICATIONS.length} today
            </span>
          </div>
          <ul className="max-h-80 overflow-y-auto py-1">
            {DEMO_NOTIFICATIONS.map((notification) => (
              <li key={notification.id}>
                <div className="flex gap-2.5 px-4 py-2.5 transition-colors hover:bg-slate-50">
                  <span
                    className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${
                      notification.kind === "stalled"
                        ? "bg-amber-100 text-amber-600"
                        : "bg-emerald-100 text-emerald-600"
                    }`}
                  >
                    {notification.kind === "stalled" ? (
                      <TopSvg className="h-4 w-4">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 7v5l3 3" />
                      </TopSvg>
                    ) : (
                      <TopSvg className="h-4 w-4">
                        <rect x="3" y="4" width="18" height="17" rx="2" />
                        <path d="M16 2v4" />
                        <path d="M8 2v4" />
                        <path d="M3 10h18" />
                      </TopSvg>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-slate-800">
                      {notification.title}
                    </span>
                    <span className="block truncate text-[12px] text-slate-500">
                      {notification.detail}
                    </span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="block border-t border-slate-100 px-4 py-2.5 text-center text-[12.5px] font-semibold text-emerald-700 outline-none transition-colors hover:bg-emerald-50 focus-visible:bg-emerald-50"
          >
            Open dashboard
          </Link>
        </div>
      )}
    </div>
  );
}

/* ---------- User menu (demo identity until auth lands) ---------- */

const DEMO_USER = {
  name: "Jenny M",
  email: "jenny@jenimcrich.com",
  role: "Admin",
} as const;

function UserMenu() {
  const { open, setOpen, ref } = useDropdown();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex h-9 items-center gap-2 rounded-lg px-1 outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-emerald-400 lg:pr-2"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-[11px] font-bold text-white">
          JM
        </span>
        <span className="hidden text-left lg:block">
          <span className="block text-[12.5px] font-semibold leading-tight text-white">
            {DEMO_USER.name}
          </span>
          <span className="block text-[10.5px] leading-tight text-slate-400">
            {DEMO_USER.role}
          </span>
        </span>
        <TopSvg className="hidden h-3.5 w-3.5 text-slate-400 lg:block">
          <path d="m6 9 6 6 6-6" />
        </TopSvg>
      </button>

      {open && (
        <div className={`${POPOVER_CLASSES} w-60`} role="menu">
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[13.5px] font-semibold text-slate-900">
                {DEMO_USER.name}
              </span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-emerald-700">
                {DEMO_USER.role}
              </span>
            </div>
            <span className="block truncate text-[12px] text-slate-500">{DEMO_USER.email}</span>
          </div>
          <div className="py-1">
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-[13px] font-medium text-slate-700 outline-none transition-colors hover:bg-slate-50 focus-visible:bg-slate-50"
            >
              <TopSvg className="h-4 w-4 text-slate-400">
                <line x1="21" x2="14" y1="5" y2="5" />
                <line x1="10" x2="3" y1="5" y2="5" />
                <line x1="21" x2="12" y1="12" y2="12" />
                <line x1="8" x2="3" y1="12" y2="12" />
                <line x1="21" x2="16" y1="19" y2="19" />
                <line x1="12" x2="3" y1="19" y2="19" />
                <line x1="14" x2="14" y1="3" y2="7" />
                <line x1="8" x2="8" y1="10" y2="14" />
                <line x1="16" x2="16" y1="17" y2="21" />
              </TopSvg>
              Settings
            </Link>
            <Link
              href="/login"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-[13px] font-medium text-red-600 outline-none transition-colors hover:bg-red-50 focus-visible:bg-red-50"
            >
              <TopSvg className="h-4 w-4">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" x2="9" y1="12" y2="12" />
              </TopSvg>
              Sign out
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Topbar ---------- */

export function Topbar({ title }: { title?: string }) {
  const pathname = usePathname() ?? "";
  const pageTitle = title ?? pageTitleFor(pathname);

  return (
    <header className="relative z-40 flex h-16 shrink-0 items-center gap-3 border-b border-slate-800 bg-[#0f172a] px-4 lg:px-6">
      <h1 className="min-w-0 flex-1 truncate text-[17px] font-semibold tracking-tight text-white">
        {pageTitle}
      </h1>

      {/* Global search — UI only for now */}
      <div className="relative hidden w-64 md:block xl:w-80">
        <TopSvg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </TopSvg>
        <input
          type="search"
          aria-label="Search candidates and jobs"
          placeholder="Search candidates, jobs…"
          className="h-9 w-full rounded-lg border border-white/10 bg-white/5 pl-9 pr-11 text-[13px] text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-emerald-500/60 focus:bg-white/10 focus:ring-2 focus:ring-emerald-500/30"
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
          ⌘K
        </kbd>
      </div>

      <NotificationsBell />
      <UserMenu />
    </header>
  );
}
