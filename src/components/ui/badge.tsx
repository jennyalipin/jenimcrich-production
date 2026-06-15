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

// Each chip carries a same-hue hairline ring (inset) for crafted definition.
const variantClass: Record<BadgeVariant, string> = {
  default: "bg-slate-200 text-slate-700 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.1)]",
  success: "bg-primary-soft text-primary-ink shadow-[inset_0_0_0_1px_rgb(5_150_105/0.2)]",
  warning: "bg-warning-soft text-warning-ink shadow-[inset_0_0_0_1px_rgb(217_119_6/0.2)]",
  danger: "bg-danger-soft text-danger-ink shadow-[inset_0_0_0_1px_rgb(220_38_38/0.18)]",
  info: "bg-info-soft text-info-ink shadow-[inset_0_0_0_1px_rgb(2_132_199/0.2)]",
  visa: "bg-warning-soft text-warning-ink shadow-[inset_0_0_0_1px_rgb(217_119_6/0.2)]",
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
