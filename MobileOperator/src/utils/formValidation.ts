/**
 * Shared helpers for operator registration forms: numeric/date sanitization and validation.
 */

/** Keeps digits and at most one decimal point (positive decimal typing). */
export function sanitizePositiveDecimalInput(raw: string): string {
  let s = raw.replace(/[^\d.]/g, '');
  const firstDot = s.indexOf('.');
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
  }
  return s;
}

/** True if non-empty string parses to a finite number > 0. */
export function isValidPositiveDecimal(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  const n = Number(t);
  return Number.isFinite(n) && n > 0;
}

/** Empty is valid; otherwise must be a positive decimal. */
export function isValidOptionalPositiveDecimal(s: string): boolean {
  const t = s.trim();
  if (!t) return true;
  return isValidPositiveDecimal(t);
}

/** Builds YYYY-MM-DD from digits only (max 8 digits after strip). */
export function sanitizeIsoDateInput(raw: string): string {
  const compact = raw.replace(/\D/g, '').slice(0, 8);
  if (compact.length <= 4) return compact;
  if (compact.length <= 6) return `${compact.slice(0, 4)}-${compact.slice(4)}`;
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6)}`;
}

/** Calendar-aware ISO date (YYYY-MM-DD). */
export function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.trim())) return false;
  const t = s.trim();
  const y = parseInt(t.slice(0, 4), 10);
  const m = parseInt(t.slice(5, 7), 10);
  const d = parseInt(t.slice(8, 10), 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return (
    dt.getFullYear() === y &&
    dt.getMonth() === m - 1 &&
    dt.getDate() === d
  );
}

/** Today's date in local time as YYYY-MM-DD (for comparisons with ISO date strings). */
export function getLocalIsoDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Valid ISO date that is not after today (local calendar). */
export function isIsoDatePastOrToday(s: string): boolean {
  if (!isValidIsoDate(s)) return false;
  return s.trim() <= getLocalIsoDateString();
}

/**
 * If `s` is a complete valid ISO date strictly after `maxIso`, returns `maxIso`.
 * Otherwise returns `s` (including partial input while typing).
 */
export function clampIsoDateToMax(s: string, maxIso: string): string {
  if (!isValidIsoDate(s)) return s;
  const t = s.trim();
  return t > maxIso ? maxIso : t;
}

/**
 * Whether a calendar year/month is not after the current month (for monthly logs).
 */
export function isYearMonthNotAfterNow(year: number, month: number): boolean {
  const now = new Date();
  const cy = now.getFullYear();
  const cm = now.getMonth() + 1;
  if (year > cy) return false;
  if (year < cy) return true;
  return month <= cm;
}

/** Days in month (1–12), year full year. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Calendar date (local) not after end of today. */
export function isYmdNotAfterNow(year: number, month: number, day: number): boolean {
  const now = new Date();
  const cy = now.getFullYear();
  const cm = now.getMonth() + 1;
  const cd = now.getDate();
  if (year > cy) return false;
  if (year < cy) return true;
  if (month > cm) return false;
  if (month < cm) return true;
  return day <= cd;
}
