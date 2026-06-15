"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Icon, LogoMark, cn, type IconName } from "@/components/ui";

const NAV: { label: string; href: string; icon: IconName }[] = [
  { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
  { label: "Candidates", href: "/candidates", icon: "candidates" },
  { label: "Pipeline", href: "/pipeline", icon: "stage" },
  { label: "Matchmaker", href: "/matchmaker", icon: "matchmaker" },
  { label: "Jobs", href: "/jobs", icon: "jobs" },
  { label: "Calendar", href: "/calendar", icon: "calendar" },
  { label: "Templates", href: "/templates", icon: "email" },
  { label: "Analytics", href: "/analytics", icon: "target" },
  { label: "Settings", href: "/settings", icon: "settings" },
];

/** Hamburger + slide-out nav for phones (the rail/sidebar hides below md). */
export function MobileNav() {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Open navigation"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-300 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-emerald-400 md:hidden"
        >
          <Icon name="menu" size={20} />
        </button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-64 border-slate-800 bg-sidebar p-0 text-slate-300"
      >
        <SheetHeader className="border-b border-slate-800 p-4">
          <SheetTitle className="flex items-center gap-2.5 text-white">
            <LogoMark size={28} variant="onDark" />
            <span className="text-[15px] font-bold tracking-[-0.01em]">
              Jenny Mcrich
            </span>
          </SheetTitle>
        </SheetHeader>
        <nav className="p-2">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400",
                  active
                    ? "bg-emerald-600 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white",
                )}
              >
                <Icon name={item.icon} size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
