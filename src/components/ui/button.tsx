import type { ComponentPropsWithRef } from "react";
import { cn } from "./cn";
import { Spinner } from "./spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.16)] hover:bg-primary-strong focus-visible:ring-primary-soft",
  secondary:
    "bg-slate-800 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.1)] hover:bg-sidebar focus-visible:ring-slate-300",
  ghost:
    "border border-slate-300 bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-primary-soft",
  danger:
    "bg-danger text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.16)] hover:bg-danger-strong focus-visible:ring-danger-soft",
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
        "inline-flex items-center justify-center rounded-control font-semibold outline-none transition-[transform,background-color,box-shadow,color,border-color] duration-150 will-change-transform hover:-translate-y-px active:translate-y-0 focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-55 disabled:hover:translate-y-0 motion-reduce:hover:translate-y-0 motion-reduce:transition-colors",
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
