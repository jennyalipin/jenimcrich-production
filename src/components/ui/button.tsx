import type { ComponentPropsWithRef } from "react";
import { cn } from "./cn";
import { Spinner } from "./spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

// Solid variants get a single-hue vertical gradient (lighter top → base bottom)
// plus the layered button gloss; hover brightens the gradient and lifts a pixel,
// active presses in. Gradient is reserved for solid controls (one meaningful
// surface), never large fills — keeps within the no-ambient-gradient rule.
const variantClass: Record<ButtonVariant, string> = {
  primary:
    "bg-[linear-gradient(180deg,#10b981_0%,#059669_100%)] text-white shadow-[var(--shadow-button)] hover:brightness-[1.05] active:shadow-[var(--shadow-button-press)] focus-visible:ring-primary-soft",
  secondary:
    "bg-[linear-gradient(180deg,#334155_0%,#1e293b_100%)] text-white shadow-[var(--shadow-button)] hover:brightness-[1.08] active:shadow-[var(--shadow-button-press)] focus-visible:ring-slate-300",
  ghost:
    "border border-slate-300 bg-white text-slate-600 shadow-[0_1px_1px_rgb(15_23_42/0.04)] hover:border-slate-400 hover:bg-slate-50 hover:text-slate-800 active:bg-slate-100 focus-visible:ring-primary-soft",
  danger:
    "bg-[linear-gradient(180deg,#f1606b_0%,#ef4444_100%)] text-white shadow-[var(--shadow-button)] hover:brightness-[1.05] active:shadow-[var(--shadow-button-press)] focus-visible:ring-danger-soft",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "gap-1.5 px-2.5 py-1.5 text-xs",
  md: "gap-1.5 px-4 py-2 text-[13.5px]",
};

export interface ButtonProps extends ComponentPropsWithRef<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, sets aria-busy and disables the button. */
  loading?: boolean;
  /** Full-width button (forms, login). */
  block?: boolean;
}

/**
 * Defaults to type="button" so buttons inside forms never submit by accident;
 * pass type="submit" explicitly on form actions.
 */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  block = false,
  type,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center rounded-control font-semibold outline-none transition-[transform,filter,box-shadow,color,border-color,background-color] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform hover:-translate-y-px active:translate-y-0 focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-55 disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:brightness-100 motion-reduce:hover:translate-y-0 motion-reduce:transition-[filter,box-shadow,color,border-color]",
        variantClass[variant],
        sizeClass[size],
        block && "w-full",
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}
