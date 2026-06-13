"use client";

import {
  createContext,
  useContext,
  useId,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "./cn";

interface TabsContextValue {
  value: string;
  setValue: (next: string) => void;
  idBase: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(component: string): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) {
    throw new Error(`<${component}> must be used inside <Tabs>.`);
  }
  return ctx;
}

export interface TabsProps {
  /** Uncontrolled initial tab. */
  defaultValue?: string;
  /** Controlled active tab (pair with onChange). */
  value?: string;
  onChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
}

/**
 * Compound tabs:
 *   <Tabs defaultValue="overview">
 *     <TabList aria-label="Candidate sections">
 *       <Tab value="overview">Overview</Tab>
 *       <Tab value="notes" count={3}>Notes</Tab>
 *     </TabList>
 *     <TabPanel value="overview">…</TabPanel>
 *   </Tabs>
 */
export function Tabs({ defaultValue, value, onChange, children, className }: TabsProps) {
  const idBase = useId();
  const [internal, setInternal] = useState(defaultValue ?? "");
  const active = value ?? internal;

  function setValue(next: string) {
    if (value === undefined) setInternal(next);
    onChange?.(next);
  }

  return (
    <TabsContext value={{ value: active, setValue, idBase }}>
      <div className={className}>{children}</div>
    </TabsContext>
  );
}

export interface TabListProps {
  /** Names the tab set for assistive tech, e.g. "Candidate sections". */
  "aria-label": string;
  children: ReactNode;
  className?: string;
}

/** Roving tabindex: arrows/Home/End move focus and select (automatic activation). */
export function TabList({ "aria-label": ariaLabel, children, className }: TabListProps) {
  const { setValue } = useTabsContext("TabList");

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const { key } = event;
    if (key !== "ArrowRight" && key !== "ArrowLeft" && key !== "Home" && key !== "End") {
      return;
    }
    const tabs = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'),
    );
    if (tabs.length === 0) return;

    const current = tabs.findIndex((tab) => tab === document.activeElement);
    let next: number;
    if (key === "Home") next = 0;
    else if (key === "End") next = tabs.length - 1;
    else if (key === "ArrowRight") next = current < 0 ? 0 : (current + 1) % tabs.length;
    else next = current < 0 ? tabs.length - 1 : (current - 1 + tabs.length) % tabs.length;

    const target = tabs[next];
    if (!target) return;
    event.preventDefault();
    target.focus();
    const targetValue = target.dataset.tabValue;
    if (targetValue !== undefined) setValue(targetValue);
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={cn("flex gap-1 overflow-x-auto border-b border-slate-200 scrollbar-slim", className)}
    >
      {children}
    </div>
  );
}

export interface TabProps {
  value: string;
  children: ReactNode;
  /** Optional count chip, e.g. Notes (3). */
  count?: number;
  disabled?: boolean;
  className?: string;
}

export function Tab({ value, children, count, disabled = false, className }: TabProps) {
  const { value: active, setValue, idBase } = useTabsContext("Tab");
  const selected = active === value;

  return (
    <button
      type="button"
      role="tab"
      id={`${idBase}-tab-${value}`}
      aria-selected={selected}
      aria-controls={`${idBase}-panel-${value}`}
      tabIndex={selected ? 0 : -1}
      disabled={disabled}
      data-tab-value={value}
      onClick={() => setValue(value)}
      className={cn(
        "-mb-px inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-md border-b-2 px-4 py-2 text-[13.5px] font-semibold outline-none transition-colors focus-visible:bg-primary-faint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-soft disabled:cursor-not-allowed disabled:opacity-45",
        selected
          ? "border-primary text-primary"
          : "border-transparent text-slate-500 hover:text-slate-700",
        className,
      )}
    >
      {children}
      {count !== undefined ? (
        <span
          className={cn(
            "rounded-full px-1.5 py-px text-[10.5px] font-bold tabular-nums",
            selected ? "bg-primary-soft text-primary-ink" : "bg-slate-200 text-slate-600",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

export interface TabPanelProps {
  value: string;
  children: ReactNode;
  /** Keep the panel mounted (hidden) when inactive, preserving its state. */
  keepMounted?: boolean;
  className?: string;
}

export function TabPanel({ value, children, keepMounted = false, className }: TabPanelProps) {
  const { value: active, idBase } = useTabsContext("TabPanel");
  const selected = active === value;
  if (!selected && !keepMounted) return null;

  return (
    <div
      role="tabpanel"
      id={`${idBase}-panel-${value}`}
      aria-labelledby={`${idBase}-tab-${value}`}
      hidden={!selected}
      tabIndex={0}
      className={cn("pt-4 outline-none focus-visible:ring-2 focus-visible:ring-primary-soft", className)}
    >
      {children}
    </div>
  );
}
