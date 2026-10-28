export function letterForPercent(pct: number): string {
  if (pct < 60) return "F";
  if (pct < 70) return "C";
  if (pct < 80) return "B";
  if (pct < 90) return "A";
  return "A1";
}