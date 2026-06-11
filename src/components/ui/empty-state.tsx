import type { ReactNode } from "react";
import { cn } from "./cn";

export interface EmptyStateProps {
  /** Emoji or icon element, shown in a quiet slate disc. */
  icon?: ReactNode;
  title: string;
  /** One sentence telling the user what to do next. */
  hint?: string;
  /** Usually a Button that starts the next action. */
  action?: ReactNode;
  className?: string;
}

/** An empty screen is an invitation to act — title states the fact, hint gives the next step. */
export function EmptyState({ icon, title, hint, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      {icon ? (
        <div
          aria-hidden="true"
          className="mb-3 grid size-11 place-items-center rounded-full bg-slate-100 text-xl text-slate-400"
        >
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {hint ? <p className="mt-1 max-w-sm text-[13px] text-slate-500">{hint}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
