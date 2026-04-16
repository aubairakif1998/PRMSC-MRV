import * as XLSX from "xlsx";

import {
  MONTH_NAMES,
  formatAssignedOperators,
  waterStatusLabel,
  type WaterDailyRangeDay,
  type WaterDailyRangePayload,
  type SolarMonthlyYearPayload,
} from "./loggingComplianceTypes";

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, "_").slice(0, 180);
}

function formatWaterTableDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function solarTableStatus(monthlyStatus: string): string {
  return monthlyStatus === "logged" ? "Logged" : "Missing";
}

export type WaterExcelOptions = {
  /** Rows currently shown in the daily table (one segment when the window is split). */
  tableDays: WaterDailyRangeDay[];
  /** 1-based segment index when the period is split; omit if a single segment. */
  segmentIndex?: number;
  segmentCount?: number;
};

/**
 * Exports the same columns as the on-screen table: Date, Status, Operators.
 * Rows match `tableDays` (typically the visible segment).
 */
export function downloadWaterComplianceExcel(
  data: WaterDailyRangePayload,
  options: WaterExcelOptions,
): void {
  const { tableDays, segmentIndex, segmentCount } = options;
  const ops = data.assigned_operators ?? [];
  const operatorsColumn = formatAssignedOperators(ops) || "—";

  const location = [data.village, data.settlement].filter(Boolean).join(", ");

  const segmentNote =
    segmentIndex != null &&
    segmentCount != null &&
    segmentCount > 1 &&
    `Showing segment ${segmentIndex} of ${segmentCount} (same as the table).`;

  const intro: (string | number)[][] = [
    ["Water logging compliance"],
    [],
    ["Exported", new Date().toLocaleString()],
    ["Site", data.unique_identifier],
    ["Location", location || "—"],
    ["Tehsil", data.tehsil || "—"],
    ["Period", `${data.date_from} to ${data.date_to}`],
  ];

  if (segmentNote) {
    intro.push(["Table scope", segmentNote]);
  }

  intro.push([], []);

  const headers = ["Date", "Status", "Operators (assigned to this site)"];
  const rows = tableDays.map((d) => [
    formatWaterTableDate(d.date),
    waterStatusLabel(d.daily_status),
    operatorsColumn,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([...intro, headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Daily logging");

  const seg =
    segmentIndex != null && segmentCount != null && segmentCount > 1
      ? `_seg${segmentIndex}of${segmentCount}`
      : "";
  XLSX.writeFile(
    wb,
    sanitizeFilename(
      `water-logging_${data.unique_identifier}_${data.date_from}_${data.date_to}${seg}.xlsx`,
    ),
  );
}

/**
 * Same columns as the monthly table: Month, Status (Logged / Missing).
 */
export function downloadSolarComplianceExcel(data: SolarMonthlyYearPayload): void {
  const wb = XLSX.utils.book_new();
  const location = [data.village, data.settlement].filter(Boolean).join(", ");

  const intro: (string | number)[][] = [
    ["Solar monthly logging compliance"],
    [],
    ["Exported", new Date().toLocaleString()],
    ["Site", data.unique_identifier],
    ["Location", location || "—"],
    ["Tehsil", data.tehsil || "—"],
    ["Year", data.year],
    [],
    [],
  ];

  const headers = ["Month", "Status"];
  const rows = data.months.map((m) => [
    MONTH_NAMES[m.month] ?? `Month ${m.month}`,
    solarTableStatus(m.monthly_status),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([...intro, headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, "Monthly logging");

  XLSX.writeFile(
    wb,
    sanitizeFilename(`solar-logging_${data.unique_identifier}_${data.year}.xlsx`),
  );
}
