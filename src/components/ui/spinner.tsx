import { cn } from "./cn";

export interface SpinnerProps {
  /** Accessible label. Defaults to "Loading". */
  label?: string;
  className?: string;
}

/** Inherits text color via border-current, so it adapts to any button variant. */
export function Spinner({ label = "Loading", className }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        "inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80",
        className,
      )}
    />
  );
}
