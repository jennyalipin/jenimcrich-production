"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Icon, type IconName } from "@/components/ui";

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

/** ⌘K palette: jump to any page, or run a candidate search. */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function go(href: string) {
    onOpenChange(false);
    setQuery("");
    router.push(href);
  }

  const trimmed = query.trim();

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search and navigate"
      description="Jump to a page or search candidates"
    >
      <CommandInput
        placeholder="Search candidates or jump to a page…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        {trimmed ? (
          <CommandGroup heading="Search">
            <CommandItem
              value={`search ${trimmed}`}
              onSelect={() => go(`/candidates?q=${encodeURIComponent(trimmed)}`)}
            >
              <Icon name="search" className="text-slate-500" />
              Search candidates for “{trimmed}”
            </CommandItem>
          </CommandGroup>
        ) : null}
        <CommandGroup heading="Go to">
          {NAV.map((item) => (
            <CommandItem key={item.href} value={item.label} onSelect={() => go(item.href)}>
              <Icon name={item.icon} className="text-slate-500" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
