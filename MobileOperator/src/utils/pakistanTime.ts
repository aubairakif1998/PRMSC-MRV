/** Pakistan Standard Time (Karachi / Islamabad). No DST — always UTC+5. */
export const PAKISTAN_TIME_ZONE = 'Asia/Karachi';

const PKT_OFFSET = '+05:00';

export type PakistanDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function readParts(
  date: Date,
  includeTime: boolean,
): Record<string, number> {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: PAKISTAN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(includeTime
      ? {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }
      : {}),
  });
  const out: Record<string, number> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') {
      out[part.type] = Number(part.value);
    }
  }
  return out;
}

/** Calendar + clock parts in Pakistan (PKT). */
export function getPakistanDateParts(
  date: Date = new Date(),
): PakistanDateParts {
  const p = readParts(date, true);
  return {
    year: p.year ?? 0,
    month: p.month ?? 1,
    day: p.day ?? 1,
    hour: p.hour ?? 0,
    minute: p.minute ?? 0,
    second: p.second ?? 0,
  };
}

/** Today (or the given instant) as YYYY-MM-DD in Pakistan. */
export function getPakistanIsoDateString(date: Date = new Date()): string {
  const { year, month, day } = getPakistanDateParts(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getPakistanYear(date: Date = new Date()): number {
  return getPakistanDateParts(date).year;
}

export function getPakistanMonth(date: Date = new Date()): number {
  return getPakistanDateParts(date).month;
}

export function getPakistanDay(date: Date = new Date()): number {
  return getPakistanDateParts(date).day;
}

/** UTC ms for 00:00:00 PKT on the Pakistan calendar day of `date`. */
export function getPakistanDayStartMs(date: Date = new Date()): number {
  const iso = getPakistanIsoDateString(date);
  return new Date(`${iso}T00:00:00${PKT_OFFSET}`).getTime();
}

export function subtractPakistanDays(isoDate: string, days: number): string {
  const anchor = new Date(`${isoDate}T12:00:00${PKT_OFFSET}`);
  anchor.setUTCDate(anchor.getUTCDate() - days);
  return getPakistanIsoDateString(anchor);
}

export function formatPakistanDateTime(
  value?: string | null | unknown,
  empty = '—',
): string {
  if (value == null || value === '') return empty;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-GB', {
    timeZone: PAKISTAN_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatPakistanDate(
  value?: string | null | unknown,
  empty = '—',
): string {
  if (value == null || value === '') return empty;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB', {
    timeZone: PAKISTAN_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatPakistanDateTimeMedium(
  value?: string | null | unknown,
  empty = '—',
): string {
  if (value == null || value === '') return empty;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-GB', {
    timeZone: PAKISTAN_TIME_ZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/** ISO UTC timestamp for API insert/update metadata. */
export function nowIsoTimestamp(): string {
  return new Date().toISOString();
}
