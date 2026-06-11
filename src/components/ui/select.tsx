import type { ComponentPropsWithRef } from "react";
import { cn } from "./cn";
import { controlClass } from "./control";

const CHEVRON =
  "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M4 6l4 4 4-4' stroke='%2364748b' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")";

export interface SelectProps extends ComponentPropsWithRef<"select"> {
  /** Marks the field invalid (red border/halo) and sets aria-invalid. */
  invalid?: boolean;
}

/** Native select with a custom slate chevron; same chrome as Input. */
export function Select({ invalid, className, style, children, ...rest }: SelectProps) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cn(
        controlClass,
        "appearance-none bg-no-repeat pr-9 [background-position:right_0.65rem_center]",
        className,
      )}
      style={{ backgroundImage: CHEVRON, ...style }}
      {...rest}
    >
      {children}
    </select>
  );
}
