export type ExecutiveScopeFilters = {
  tehsil: string;
  village: string;
  month: string;
  year: string;
};

export type WaterSystemDetailRow = {
  water_system_id: string;
  unique_identifier?: string | null;
  tehsil: string;
  village: string;
  settlement?: string | null;
  bulk_meter_installed: boolean;
  /** Sum of per-log interval volumes (meter deltas), not cumulative readings. */
  total_water_pumped_m3: number;
  /** Cumulative bulk-meter reading at the most recent log in scope. */
  latest_meter_reading_end_m3?: number | null;
  /** Latest cumulative reading minus first baseline in scope. */
  period_meter_net_m3?: number | null;
  total_pump_hours_h: number;
  days_logged: number;
  logs_count: number;
  avg_m3_per_hour?: number | null;
  avg_m3_per_day_logged?: number | null;
  avg_hours_per_day_logged?: number | null;
};

export type SolarSystemDetailRow = {
  solar_system_id: string;
  unique_identifier?: string | null;
  tehsil: string;
  village: string;
  settlement?: string | null;
  disco_info?: string | null;
  bill_reference_number?: string | null;
  total_export_kwh: number;
  total_import_kwh: number;
  total_net_kwh: number;
  months_logged: number;
  records_count: number;
  avg_export_kwh_per_month?: number | null;
  avg_import_kwh_per_month?: number | null;
  avg_net_kwh_per_month?: number | null;
};

export const EXECUTIVE_YEARS = [2025, 2026, 2027, 2028, 2029] as const;

export const EXECUTIVE_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;
