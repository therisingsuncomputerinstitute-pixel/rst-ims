import { format } from "date-fns";

/**
 * Converts an arbitrary stored value (Date, ISO string, timestamp, null) into a
 * valid Date, or `null` when it cannot be parsed.
 *
 * Server Components crash the whole route ("Minified React error #441") when a
 * date-fns `format()` call receives an invalid date, so every date rendered in
 * the UI should go through this helper first.
 */
export function toSafeDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Formats a stored date value safely, returning `fallback` when invalid. */
export function fmtDate(value: unknown, pattern: string, fallback = "—"): string {
  const date = toSafeDate(value);
  return date ? format(date, pattern) : fallback;
}
