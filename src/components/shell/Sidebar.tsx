"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { Icon, LogoMark, cn, type IconName } from "@/components/ui";

/**
 * Fixed-width navigation rail for the JeniMcRich shell.
 * - lg and up: full 240px sidebar with labels.
 * - below lg: 64px icon rail (labels hidden, items get a title tooltip).
 * Dark frame color is the exact brief hex (#0f172a); active route is emerald-600.
 */

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/candidates", label: "Candidates", icon: "candidates" },
  { href: "/pipeline", label: "Pipeline", icon: "stage" },
  { href: "/matchmaker", label: "Matchmaker", icon: "matchmaker" },
  { href: "/jobs", label: "Jobs", icon: "jobs" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
  { href: "/templates", label: "Templates", icon: "email" },
  { href: "/analytics", label: "Analytics", icon: "target" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const COLLAPSE_KEY = "jmr-sidebar-collapsed";

// localStorage-backed collapse pref via useSyncExternalStore: no setState-in-
// effect, and the server snapshot (false) matches first client render, so there
// is no hydration mismatch.
function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}
function collapsedSnapshot(): boolean {
  return localStorage.getItem(COLLAPSE_KEY) === "1";
}

export function Sidebar() {
  const pathname = usePathname() ?? "";

  // Collapse only affects lg+ (below lg the rail is already 64px).
  const collapsed = useSyncExternalStore(subscribe, collapsedSnapshot, () => false);
  function toggle() {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "0" : "1");
    } catch {
      /* private mode — ignore */
    }
    // Same-tab listeners don't get the native storage event; nudge them.
    window.dispatchEvent(new Event("storage"));
  }

  // When collapsed, drop the lg:* expand classes so it stays a 64px icon rail.
  const expandW = collapsed ? "" : "lg:w-60";
  const showLabel = collapsed ? "hidden" : "hidden lg:inline";
  const rowExpand = collapsed ? "" : "lg:justify-start lg:px-3";

  return (
    <aside
      className={cn(
        "hidden h-full w-16 shrink-0 flex-col border-r border-slate-800 bg-[#0f172a] transition-[width] duration-200 md:flex",
        expandW,
      )}
    >
      {/* Brand */}
      <Link
        href="/dashboard"
        className={cn(
          "flex h-16 shrink-0 items-center justify-center gap-2.5 border-b border-slate-800 px-2 outline-none focus-visible:bg-slate-800",
          collapsed ? "" : "lg:justify-start lg:px-4",
        )}
      >
        <LogoMark size={34} variant="onDark" className="shrink-0" />
        <span className={cn("min-w-0 flex-col", collapsed ? "hidden" : "hidden lg:flex")}>
          <span className="truncate text-[15px] font-bold leading-tight text-white">
            Jenny Mcrich
          </span>
          <span className="text-[10px] font-semibold tracking-[0.14em] text-slate-400">
            RECRUITMENT
          </span>
        </span>
      </Link>

      {/* Primary navigation */}
      <nav
        aria-label="Primary"
        className={cn("flex-1 space-y-0.5 overflow-y-auto px-2 py-3", collapsed ? "" : "lg:px-3")}
      >
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex items-center justify-center gap-2.5 rounded-lg px-2 py-2 text-[13.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400",
                rowExpand,
                active
                  ? "bg-emerald-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white",
              )}
            >
              <Icon
                name={item.icon}
                size={18}
                className="shrink-0 transition-transform duration-150 ease-out group-hover:scale-110"
              />
              <span className={cn("truncate", showLabel)}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Foot: collapse toggle (lg-only). */}
      <div
        className={cn(
          "flex h-12 shrink-0 items-center justify-center border-t border-slate-800 px-2",
          rowExpand,
        )}
      >
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className={cn(
            "hidden h-7 w-7 place-items-center rounded-lg text-slate-400 outline-none transition-colors hover:bg-slate-800 hover:text-white focus-visible:ring-2 focus-visible:ring-emerald-400 lg:grid",
            collapsed ? "" : "ml-auto",
          )}
        >
          {/* chevron-right to expand, flipped to chevron-left to collapse */}
          <Icon
            name="chevronRight"
            size={18}
            className={cn("shrink-0", collapsed ? "" : "rotate-180")}
          />
        </button>
      </div>
    </aside>
  );
}
