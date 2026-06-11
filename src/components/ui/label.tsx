import type { ComponentPropsWithRef } from "react";
import { cn } from "./cn";

export interface LabelProps extends ComponentPropsWithRef<"label"> {
  /** Appends a red asterisk for required fields. */
  requiredMark?: boolean;
}

/** Field label in the system's micro-label register (11px uppercase). */
export function Label({ requiredMark = false, className, children, ...rest }: LabelProps) {
  return (
    <label className={cn("micro-label mb-1.5 block text-slate-600", className)} {...rest}>
      {children}
      {requiredMark ? (
        <span aria-hidden="true" className="ml-0.5 text-danger">
          *
        </span>
      ) : null}
    </label>
  );
}
