/**
 * Brand logo for Jenny Mcrich Recruitment.
 *
 * `LogoMark` is the brand symbol — a "j" built from two figures: a smaller
 * accent person ascending beside a taller figure, reading as placement /
 * advancement (a candidate moved into a role). It is NOT a lettered
 * monogram-in-a-box.
 *
 * Variants mirror the delivered asset set (public/brand):
 *   - "color"  two-tone emerald + slate — full-colour mark on light surfaces
 *   - "onDark" two-tone, slate figure → white + brighter emerald, on dark chrome
 *   - "light"  monochrome slate — one-colour use on light surfaces
 *   - "dark"   monochrome white — one-colour use on dark surfaces
 *
 * `Logo` pairs the mark with the "Jenny Mcrich" wordmark.
 */

import { cn } from "./cn";

export type LogoVariant = "color" | "onDark" | "light" | "dark";

// Per-variant fills: `figure` = taller "j" body+head, `accent` = the smaller
// ascending figure. Mono variants paint both the same colour.
const VARIANT_FILLS: Record<LogoVariant, { figure: string; accent: string }> = {
  color: { figure: "#0c182c", accent: "#038f61" },
  onDark: { figure: "#ffffff", accent: "#10b981" },
  light: { figure: "#0c172b", accent: "#0c172b" },
  dark: { figure: "#ffffff", accent: "#ffffff" },
};

export function LogoMark({
  size = 28,
  className,
  title = "Jenny Mcrich",
  variant = "color",
}: {
  size?: number;
  className?: string;
  title?: string;
  variant?: LogoVariant;
}) {
  const { figure, accent } = VARIANT_FILLS[variant];
  return (
    <svg
      width={size}
      height={size}
      // Tight square crop around the (tall, narrow) mark for optical sizing.
      viewBox="172 172 680 680"
      fill="none"
      role="img"
      aria-label={title}
      className={className}
    >
      {/* taller figure — the body + head of the "j" */}
      <path
        fill={figure}
        d="M520.38,811.63l.34-155.66c.07-32.3,30.7-63.53,64.85-65.78-34.91-2.99-63.1-30.96-65.18-66.53l-.02-154.86h142.23s-.02,304.71-.02,304.71c-.66,37.1-15.45,71.03-41.98,96.46-26.1,26.92-61.27,42.04-100.22,41.65Z"
      />
      <circle fill={figure} cx="591.49" cy="282.72" r="71.07" />
      {/* smaller accent figure ascending alongside */}
      <path
        fill={accent}
        d="M504.07,657.21l.23,154.41c-38.13.5-73.87-14.38-100.26-41.65-26.4-25.44-41.79-59.33-41.85-96.33l-.13-82.48,82.81.39c14.86.07,27.25,9.37,37.98,18.57,12.22,12.78,21.19,28.12,21.22,47.1Z"
      />
      <circle fill={accent} cx="433.18" cy="509.04" r="71.06" />
    </svg>
  );
}

export function Logo({
  className,
  markSize = 30,
  /** Hide the wordmark (collapsed rail). */
  wordmark = true,
  /** Render on dark chrome: white wordmark + dark-adapted mark. */
  onDark = false,
}: {
  className?: string;
  markSize?: number;
  wordmark?: boolean;
  onDark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark
        size={markSize}
        variant={onDark ? "onDark" : "color"}
        className="shrink-0"
      />
      {wordmark ? (
        <span
          className={cn(
            "text-[15px] font-bold leading-none tracking-[-0.01em]",
            onDark ? "text-white" : "text-ink",
          )}
        >
          Jenny Mcrich
        </span>
      ) : null}
    </span>
  );
}
