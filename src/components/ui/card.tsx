import type { ComponentPropsWithRef } from "react";
import { cn } from "./cn";

/** White work surface: 12px radius, slate-200 hairline, slate-tinted shadow. */
export function Card({ className, children, ...rest }: ComponentPropsWithRef<"div">) {
  return (
    <div
      className={cn("rounded-card border border-slate-200 bg-surface shadow-card", className)}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Title row; put a CardTitle on the left and actions on the right. */
export function CardHeader({ className, children, ...rest }: ComponentPropsWithRef<"div">) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...rest }: ComponentPropsWithRef<"h3">) {
  return (
    <h3 className={cn("text-[15px] font-semibold text-ink", className)} {...rest}>
      {children}
    </h3>
  );
}

export function CardBody({ className, children, ...rest }: ComponentPropsWithRef<"div">) {
  return (
    <div className={cn("p-5", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...rest }: ComponentPropsWithRef<"div">) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2.5 border-t border-slate-200 px-5 py-3.5",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
