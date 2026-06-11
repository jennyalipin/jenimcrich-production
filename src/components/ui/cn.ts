/** Joins class names, skipping falsy values. Local stand-in for clsx. */
export function cn(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter((v): v is string => typeof v === "string" && v !== "").join(" ");
}
