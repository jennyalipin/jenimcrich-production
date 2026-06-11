import type { ComponentPropsWithRef } from "react";
import { cn } from "./cn";
import { controlClass } from "./control";

export interface InputProps extends ComponentPropsWithRef<"input"> {
  /** Marks the field invalid (red border/halo) and sets aria-invalid. */
  invalid?: boolean;
}

export function Input({ invalid, className, ...rest }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(controlClass, className)}
      {...rest}
    />
  );
}
