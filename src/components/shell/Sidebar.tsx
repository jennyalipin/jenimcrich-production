"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/ui";

/**
 * Fixed-width navigation rail for the JeniMcRich shell.
 * - lg and up: full 240px sidebar with labels.
 * - below lg: 64px icon rail (labels hidden, items get a title tooltip).
 * Dark frame color is the exact brief hex (#0f172a); active route is emerald-600.
 */

function NavSvg({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px] shrink-0"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <NavSvg>
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </NavSvg>
    ),
  },
  {
    href: "/candidates",
    label: "Candidates",
    icon: (
      <NavSvg>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </NavSvg>
    ),
  },
  {
    href: "/pipeline",
    label: "Pipeline",
    icon: (
      <NavSvg>
        <rect x="3" y="3" width="5" height="12" rx="1" />
        <rect x="9.5" y="3" width="5" height="16" rx="1" />
        <rect x="16" y="3" width="5" height="9" rx="1" />
      </NavSvg>
    ),
  },
  {
    href: "/matchmaker",
    label: "Matchmaker",
    icon: (
      <NavSvg>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </NavSvg>
    ),
  },
  {
    href: "/jobs",
    label: "Jobs",
    icon: (
      <NavSvg>
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      </NavSvg>
    ),
  },
  {
    href: "/calendar",
    label: "Calendar",
    icon: (
      <NavSvg>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M16 2v4" />
        <path d="M8 2v4" />
        <path d="M3 10h18" />
      </NavSvg>
    ),
  },
  {
    href: "/templates",
    label: "Templates",
    icon: (
      <NavSvg>
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </NavSvg>
    ),
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: (
      <NavSvg>
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </NavSvg>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (
      <NavSvg>
        <line x1="21" x2="14" y1="5" y2="5" />
        <line x1="10" x2="3" y1="5" y2="5" />
        <line x1="21" x2="12" y1="12" y2="12" />
        <line x1="8" x2="3" y1="12" y2="12" />
        <line x1="21" x2="16" y1="19" y2="19" />
        <line x1="12" x2="3" y1="19" y2="19" />
        <line x1="14" x2="14" y1="3" y2="7" />
        <line x1="8" x2="8" y1="10" y2="14" />
        <line x1="16" x2="16" y1="17" y2="21" />
      </NavSvg>
    ),
  },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname() ?? "";
  // NEXT_PUBLIC_* is inlined at build time, so this is a safe client read of
  // whether the app is wired to Supabase vs. the in-memory demo data.
  const liveData = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

  return (
    <aside className="flex h-full w-16 shrink-0 flex-col border-r border-slate-800 bg-[#0f172a] lg:w-60">
      {/* Brand */}
      <Link
        href="/dashboard"
        className="flex h-16 shrink-0 items-center justify-center gap-2.5 border-b border-slate-800 px-2 outline-none focus-visible:bg-slate-800 lg:justify-start lg:px-4"
      >
        <LogoMark size={34} className="shrink-0" />
        <span className="hidden min-w-0 flex-col lg:flex">
          <span className="truncate text-[15px] font-bold leading-tight text-white">
            JeniMc<span className="text-emerald-400">Rich</span>
          </span>
          <span className="text-[10px] font-semibold tracking-[0.14em] text-slate-400">
            RECRUITMENT
          </span>
        </span>
      </Link>

      {/* Primary navigation */}
      <nav
        aria-label="Primary"
        className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3 lg:px-3"
      >
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-current={active ? "page" : undefined}
              className={`flex items-center justify-center gap-2.5 rounded-lg px-2 py-2 text-[13.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400 lg:justify-start lg:px-3 ${
                active
                  ? "bg-emerald-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {item.icon}
              <span className="hidden truncate lg:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Foot: data-source status — reflects whether Supabase is wired up. */}
      <div
        className="flex h-12 shrink-0 items-center justify-center gap-2 border-t border-slate-800 px-2 lg:justify-start lg:px-4"
        title={
          liveData
            ? "Connected to Supabase — changes persist to the database"
            : "Running on built-in demo data — Supabase is not connected yet"
        }
      >
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${liveData ? "bg-emerald-500" : "bg-amber-400"}`}
          aria-hidden="true"
        />
        <span className="hidden text-[11px] font-medium text-slate-400 lg:inline">
          {liveData ? "Supabase connected" : "Demo data mode"}
        </span>
      </div>
    </aside>
  );
}
