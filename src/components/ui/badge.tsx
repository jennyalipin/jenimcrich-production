import type { ReactNode } from "react";
import { cn } from "./cn";
import { Icon } from "./icon";

export type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "visa";

/** Shared chip base — also used by StageBadge so every chip in the app matches. */
export const badgeBaseClass =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold leading-4";

const variantClass: Record<BadgeVariant, string> = {
  default: "bg-slate-200 text-slate-700",
  success: "bg-primary-soft text-primary-ink",
  warning: "bg-warning-soft text-warning-ink",
  danger: "bg-danger-soft text-danger-ink",
  info: "bg-info-soft text-info-ink",
  visa: "bg-warning-soft text-warning-ink",
};

export interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
  title?: string;
}

/**
 * Status chip. The `visa` variant renders the passport-control prefix used
 * for restrictive work-authorization requirements (e.g. TN — Canadian only).
 */
export function Badge({ variant = "default", children, className, title }: BadgeProps) {
  return (
    <span title={title} className={cn(badgeBaseClass, variantClass[variant], className)}>
      {variant === "visa" ? <Icon name="visa" size={12} className="-ml-0.5" /> : null}
      {children}
    </span>
  );
}
