/**
 * Formatting helpers — dates, relative time, salary, initials.
 *
 * All date helpers default to UTC + en-US so that Server Components and
 * client hydration render identical strings regardless of machine timezone.
 * Pass `{ locale, timeZone }` to render in the user's locale when the value
 * is rendered client-side only.
 */

export type DateInput = string | number | Date;

export interface FormatOptions {
  locale?: string;
  timeZone?: string;
}

const DAY_MS = 86_400_000;
const DEFAULT_LOCALE = "en-US";
const DEFAULT_TZ = "UTC";

function toDate(input: DateInput): Date {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date value: ${String(input)}`);
  }
  return d;
}

/** Memoized Intl.DateTimeFormat instances (they are expensive to construct). */
const dtfCache = new Map<string, Intl.DateTimeFormat>();

function dtf(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = locale + JSON.stringify(options);
  let fmt = dtfCache.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, options);
    dtfCache.set(key, fmt);
  }
  return fmt;
}

/** "Jun 11, 2026" */
export function formatDate(input: DateInput, opts: FormatOptions = {}): string {
  return dtf(opts.locale ?? DEFAULT_LOCALE, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: opts.timeZone ?? DEFAULT_TZ,
  }).format(toDate(input));
}

/** "Jun 11" — for dense tables/cards. */
export function formatShortDate(input: DateInput, opts: FormatOptions = {}): string {
  return dtf(opts.locale ?? DEFAULT_LOCALE, {
    month: "short",
    day: "numeric",
    timeZone: opts.timeZone ?? DEFAULT_TZ,
  }).format(toDate(input));
}

/** "Thu, Jun 11" — calendar labels. */
export function formatDayLabel(input: DateInput, opts: FormatOptions = {}): string {
  return dtf(opts.locale ?? DEFAULT_LOCALE, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: opts.timeZone ?? DEFAULT_TZ,
  }).format(toDate(input));
}

/** "9:00 AM" */
export function formatTime(input: DateInput, opts: FormatOptions = {}): string {
  return dtf(opts.locale ?? DEFAULT_LOCALE, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: opts.timeZone ?? DEFAULT_TZ,
  }).format(toDate(input));
}

/** "Jun 11, 9:00 AM" — compact, no year. */
export function formatDateTime(input: DateInput, opts: FormatOptions = {}): string {
  return dtf(opts.locale ?? DEFAULT_LOCALE, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: opts.timeZone ?? DEFAULT_TZ,
  }).format(toDate(input));
}

/** "Jun 11, 2026, 9:00 AM" */
export function formatFullDateTime(input: DateInput, opts: FormatOptions = {}): string {
  return dtf(opts.locale ?? DEFAULT_LOCALE, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: opts.timeZone ?? DEFAULT_TZ,
  }).format(toDate(input));
}

/**
 * Whole days from `from` to `to` (signed, floor). Pure millisecond math —
 * timezone-agnostic and DST-safe.
 */
export function daysBetween(from: DateInput, to: DateInput): number {
  return Math.floor((toDate(to).getTime() - toDate(from).getTime()) / DAY_MS);
}

/**
 * Whole days elapsed since `input`, never negative.
 * Pass `now` explicitly (e.g. the data layer's REFERENCE_NOW) for
 * deterministic SSR output.
 */
export function daysSince(input: DateInput, now: DateInput = new Date()): number {
  return Math.max(0, daysBetween(input, now));
}

/** "12d" — kanban cards / dense tables. */
export function formatDaysCompact(days: number): string {
  return `${Math.max(0, Math.round(days))}d`;
}

const RELATIVE_STEPS: ReadonlyArray<readonly [limitMs: number, divisorMs: number, unit: Intl.RelativeTimeFormatUnit]> = [
  [60_000, 1_000, "second"],
  [3_600_000, 60_000, "minute"],
  [DAY_MS, 3_600_000, "hour"],
  [7 * DAY_MS, DAY_MS, "day"],
  [30 * DAY_MS, 7 * DAY_MS, "week"],
  [365 * DAY_MS, 30 * DAY_MS, "month"],
];

const rtfCache = new Map<string, Intl.RelativeTimeFormat>();

/**
 * "3 days ago" / "in 2 hours" / "just now".
 * Pass `now` explicitly (e.g. REFERENCE_NOW) for deterministic SSR output.
 */
export function relativeTime(
  input: DateInput,
  now: DateInput = new Date(),
  locale: string = DEFAULT_LOCALE,
): string {
  const diff = toDate(input).getTime() - toDate(now).getTime();
  const abs = Math.abs(diff);
  if (abs < 45_000) return "just now";

  let rtf = rtfCache.get(locale);
  if (!rtf) {
    rtf = new Intl.RelativeTimeFormat(locale, { numeric: "always" });
    rtfCache.set(locale, rtf);
  }
  for (const [limit, divisor, unit] of RELATIVE_STEPS) {
    if (abs < limit) return rtf.format(Math.trunc(diff / divisor), unit);
  }
  return rtf.format(Math.trunc(diff / (365 * DAY_MS)), "year");
}

/**
 * Initials for avatars: "Alex Miller" → "AM", "C. dela Peña" → "CP".
 * Unicode-aware; uses first + last word when the name has more words than `max`.
 */
export function initials(fullName: string, max = 2): string {
  const words = fullName
    .trim()
    .split(/\s+/)
    .filter((w) => /\p{L}/u.test(w));
  if (words.length === 0) return "?";
  const firstLetters = words.map(
    (w) => Array.from(w).find((ch) => /\p{L}/u.test(ch)) ?? "",
  );
  const picked =
    firstLetters.length <= max
      ? firstLetters
      : [...firstLetters.slice(0, max - 1), firstLetters[firstLetters.length - 1]];
  return picked.join("").toUpperCase();
}

/**
 * Salary ranges are stored as free text (multi-currency agency).
 * Normalizes whitespace and renders an em dash placeholder when missing.
 */
export function formatSalary(range: string | null | undefined): string {
  const trimmed = range?.trim();
  return trimmed && trimmed.length > 0 ? trimmed.replace(/\s+/g, " ") : "—";
}

/** "1,204" */
export function formatNumber(value: number, locale: string = DEFAULT_LOCALE): string {
  return new Intl.NumberFormat(locale).format(value);
}

/** 0.5 stays 50 → "50%" expects a 0–100 value. */
export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}
