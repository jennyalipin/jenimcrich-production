import type { ReactNode } from "react";
import { cn } from "./cn";

export interface FieldErrorProps {
  /** Renders nothing when empty, so it can be wired unconditionally. */
  children?: ReactNode;
  /** Set this and point the input's aria-describedby at it. */
  id?: string;
  className?: string;
}

export function FieldError({ children, id, className }: FieldErrorProps) {
  if (children === null || children === undefined || children === false || children === "") {
    return null;
  }
  return (
    <p id={id} role="alert" className={cn("mt-1.5 text-xs font-medium text-danger-strong", className)}>
      {children}
    </p>
  );
}
