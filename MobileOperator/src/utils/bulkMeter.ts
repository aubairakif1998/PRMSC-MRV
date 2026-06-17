/** True if string is a finite non-negative number (allows 0 for meter readings). */
function isValidMeterInput(value: string): boolean {
  const t = value.trim();
  if (!t) return false;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0;
}

export function formatMeterM3(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
}

/** Returns an error message when pump-stop reading is not above the required baseline. */
export function bulkMeterOrderErrorMessage(params: {
  isFirstBulkMeterLog: boolean;
  meterReadingEnd: string;
  meterReadingStart: string;
  previousMeterReadingEnd: number | null;
}): string | null {
  const {
    isFirstBulkMeterLog,
    meterReadingEnd,
    meterReadingStart,
    previousMeterReadingEnd,
  } = params;
  if (!isValidMeterInput(meterReadingEnd)) return null;
  const endVal = Number(meterReadingEnd);
  const base = isFirstBulkMeterLog
    ? isValidMeterInput(meterReadingStart)
      ? Number(meterReadingStart)
      : null
    : previousMeterReadingEnd;
  if (base == null || !Number.isFinite(base)) return null;
  if (endVal <= base) {
    if (isFirstBulkMeterLog) {
      return `Meter reading at pump stop (${formatMeterM3(endVal)} m³) must be greater than the initial reading before pump start (${formatMeterM3(base)} m³).`;
    }
    return `Meter reading at pump stop (${formatMeterM3(endVal)} m³) must be greater than the last submitted pump-stop reading (${formatMeterM3(base)} m³). The meter increases as water is pumped.`;
  }
  return null;
}

/** Highest submitted meter_reading_end from operator water-supply rows. */
export function maxSubmittedMeterEndFromRows(
  rows: Array<Record<string, unknown>>,
): number | null {
  let max: number | null = null;
  for (const row of rows) {
    const status = String(row.status ?? '').toLowerCase();
    if (status === 'drafted' || status === 'rejected') continue;
    const end = row.meter_reading_end;
    if (end == null || end === '') continue;
    const n = Number(end);
    if (!Number.isFinite(n)) continue;
    if (max == null || n > max) max = n;
  }
  return max;
}
