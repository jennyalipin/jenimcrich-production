"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

/**
 * Application frame: fixed dark Sidebar + dark Topbar + independently
 * scrollable light main region. Pages own their content padding
 * (the prototype uses ~p-6); the main region applies none, so full-bleed
 * views like the pipeline board stay possible.
 *
 * The /login route renders bare (no shell).
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const isAuthRoute = pathname === "/login" || pathname.startsWith("/login/");

  if (isAuthRoute) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50 text-slate-800">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-emerald-600 focus:px-3 focus:py-2 focus:text-[13px] focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main id="main-content" className="min-w-0 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
