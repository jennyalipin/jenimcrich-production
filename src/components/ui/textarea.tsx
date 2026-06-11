import type { ComponentPropsWithRef } from "react";
import { cn } from "./cn";
import { controlClass } from "./control";

export interface TextareaProps extends ComponentPropsWithRef<"textarea"> {
  /** Marks the field invalid (red border/halo) and sets aria-invalid. */
  invalid?: boolean;
}

export function Textarea({ invalid, className, ...rest }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(controlClass, "min-h-22 resize-y leading-relaxed", className)}
      {...rest}
    />
  );
}
