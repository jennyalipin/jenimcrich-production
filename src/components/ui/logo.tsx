/**
 * Brand logo for JeniMcRich Recruitment.
 *
 * `LogoMark` is a crafted SVG symbol — two ascending chevron bands, reading as
 * upward movement / placement (a candidate advanced into a role). It is NOT a
 * lettered monogram-in-a-box. `Logo` pairs the mark with the wordmark, with
 * "Rich" set in the Signifier serif accent.
 */

import { cn } from "./cn";

export function LogoMark({
  size = 28,
  className,
  title = "JeniMcRich",
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      role="img"
      aria-label={title}
      className={className}
    >
      <defs>
        <linearGradient id="jmr-mark" x1="4" y1="3" x2="24" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10b981" />
          <stop offset="1" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      {/* upper chevron band */}
      <path
        d="M14 3.2 L24 11.6 L20.2 11.6 L14 6.4 L7.8 11.6 L4 11.6 Z"
        fill="url(#jmr-mark)"
      />
      {/* lower chevron band */}
      <path
        d="M14 11.8 L24 20.2 L20.2 20.2 L14 15 L7.8 20.2 L4 20.2 Z"
        fill="url(#jmr-mark)"
        opacity="0.55"
      />
    </svg>
  );
}

export function Logo({
  className,
  markSize = 30,
  /** Hide the wordmark (collapsed rail). */
  wordmark = true,
  /** Render the wordmark in white (on the dark sidebar). */
  onDark = false,
}: {
  className?: string;
  markSize?: number;
  wordmark?: boolean;
  onDark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={markSize} className="shrink-0" />
      {wordmark ? (
        <span
          className={cn(
            "text-[15px] font-bold leading-none tracking-[-0.01em]",
            onDark ? "text-white" : "text-ink",
          )}
        >
          JeniMc<span className="serif-accent font-medium text-primary">Rich</span>
        </span>
      ) : null}
    </span>
  );
}
