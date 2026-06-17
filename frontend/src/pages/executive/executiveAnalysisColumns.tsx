import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { DataGridColumnMeta } from "@/components/DataGrid";
import type {
  SolarSystemDetailRow,
  WaterSystemDetailRow,
} from "./executiveAnalysisTypes";

function fmtNum(v: unknown, maxFrac = 2): string {
  const n = Number(v);
  return Number.isFinite(n)
    ? new Intl.NumberFormat(undefined, { maximumFractionDigits: maxFrac }).format(n)
    : "—";
}

function fmtInt(v: unknown): string {
  return fmtNum(v, 0);
}

export function useWaterAnalysisColumns(): Array<ColumnDef<WaterSystemDetailRow>> {
  return useMemo(
    () => [
      {
        accessorKey: "unique_identifier",
        header: "System ID",
        meta: { filterVariant: "text" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => (
          <span className="font-medium text-foreground">{String(getValue() ?? "—")}</span>
        ),
      },
      {
        accessorKey: "tehsil",
        header: "Tehsil",
        meta: { filterVariant: "select" } satisfies DataGridColumnMeta,
      },
      {
        accessorKey: "village",
        header: "Village",
        meta: { filterVariant: "select" } satisfies DataGridColumnMeta,
      },
      {
        accessorKey: "settlement",
        header: "Settlement",
        meta: { filterVariant: "text" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => String(getValue() ?? "—"),
      },
      {
        accessorKey: "bulk_meter_installed",
        header: "Bulk meter",
        meta: {
          filterVariant: "select",
          filterOptions: ["Yes", "No"],
        } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => (getValue() ? "Yes" : "No"),
        filterFn: (row, _id, value) => {
          if (!value || value === "all") return true;
          const yes = row.original.bulk_meter_installed;
          return value === "Yes" ? yes : !yes;
        },
      },
      {
        accessorKey: "total_water_pumped_m3",
        header: "Total pumped (m³)",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => (
          <span className="tabular-nums">{fmtInt(getValue())}</span>
        ),
      },
      {
        accessorKey: "latest_meter_reading_end_m3",
        header: "Latest meter (m³)",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => (
          <span className="tabular-nums">{fmtInt(getValue())}</span>
        ),
      },
      {
        accessorKey: "period_meter_net_m3",
        header: "Meter net (m³)",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => (
          <span className="tabular-nums">{fmtInt(getValue())}</span>
        ),
      },
      {
        accessorKey: "total_pump_hours_h",
        header: "Runtime (h)",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => (
          <span className="tabular-nums">{fmtNum(getValue())}</span>
        ),
      },
      {
        accessorKey: "days_logged",
        header: "Days logged",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => (
          <span className="tabular-nums">{fmtInt(getValue())}</span>
        ),
      },
      {
        accessorKey: "logs_count",
        header: "Log entries",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => (
          <span className="tabular-nums">{fmtInt(getValue())}</span>
        ),
      },
      {
        accessorKey: "avg_m3_per_hour",
        header: "m³ / hour",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => (
          <span className="tabular-nums">{fmtNum(getValue())}</span>
        ),
      },
      {
        accessorKey: "avg_m3_per_day_logged",
        header: "m³ / day",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => (
          <span className="tabular-nums">{fmtNum(getValue())}</span>
        ),
      },
      {
        accessorKey: "avg_hours_per_day_logged",
        header: "h / day",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => (
          <span className="tabular-nums">{fmtNum(getValue())}</span>
        ),
      },
    ],
    [],
  );
}

export function useSolarAnalysisColumns(): Array<ColumnDef<SolarSystemDetailRow>> {
  return useMemo(
    () => [
      {
        accessorKey: "unique_identifier",
        header: "System ID",
        meta: { filterVariant: "text" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => (
          <span className="font-medium text-foreground">{String(getValue() ?? "—")}</span>
        ),
      },
      {
        accessorKey: "tehsil",
        header: "Tehsil",
        meta: { filterVariant: "select" } satisfies DataGridColumnMeta,
      },
      {
        accessorKey: "village",
        header: "Village",
        meta: { filterVariant: "select" } satisfies DataGridColumnMeta,
      },
      {
        accessorKey: "settlement",
        header: "Settlement",
        meta: { filterVariant: "text" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => String(getValue() ?? "—"),
      },
      {
        accessorKey: "disco_info",
        header: "DISCO",
        meta: { filterVariant: "select" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => String(getValue() ?? "—"),
      },
      {
        accessorKey: "bill_reference_number",
        header: "Bill ref",
        meta: { filterVariant: "text" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => String(getValue() ?? "—"),
      },
      {
        accessorKey: "total_export_kwh",
        header: "Export (kWh)",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => (
          <span className="tabular-nums text-amber-700">{fmtInt(getValue())}</span>
        ),
      },
      {
        accessorKey: "total_import_kwh",
        header: "Import (kWh)",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => (
          <span className="tabular-nums text-red-700">{fmtInt(getValue())}</span>
        ),
      },
      {
        accessorKey: "total_net_kwh",
        header: "Net (kWh)",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => (
          <span className="tabular-nums font-medium">{fmtInt(getValue())}</span>
        ),
      },
      {
        accessorKey: "months_logged",
        header: "Months",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => (
          <span className="tabular-nums">{fmtInt(getValue())}</span>
        ),
      },
      {
        accessorKey: "records_count",
        header: "Records",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => (
          <span className="tabular-nums">{fmtInt(getValue())}</span>
        ),
      },
      {
        accessorKey: "avg_export_kwh_per_month",
        header: "Export / mo",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => (
          <span className="tabular-nums">{fmtNum(getValue())}</span>
        ),
      },
      {
        accessorKey: "avg_import_kwh_per_month",
        header: "Import / mo",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => (
          <span className="tabular-nums">{fmtNum(getValue())}</span>
        ),
      },
      {
        accessorKey: "avg_net_kwh_per_month",
        header: "Net / mo",
        meta: { filterVariant: "none" } satisfies DataGridColumnMeta,
        cell: ({ getValue }) => (
          <span className="tabular-nums">{fmtNum(getValue())}</span>
        ),
      },
    ],
    [],
  );
}

export function waterSystemDetailFields(row: WaterSystemDetailRow) {
  return [
    { label: "Water system ID", value: row.water_system_id },
    { label: "Unique identifier", value: row.unique_identifier ?? "—" },
    { label: "Tehsil", value: row.tehsil },
    { label: "Village", value: row.village },
    { label: "Settlement", value: row.settlement ?? "—" },
    { label: "Bulk meter installed", value: row.bulk_meter_installed ? "Yes" : "No" },
    {
      label: "Total pumped (interval sum)",
      value: `${fmtInt(row.total_water_pumped_m3)} m³`,
    },
    {
      label: "Latest meter reading",
      value: `${fmtInt(row.latest_meter_reading_end_m3)} m³`,
    },
    {
      label: "Meter net in period",
      value: `${fmtInt(row.period_meter_net_m3)} m³`,
    },
    { label: "Total pump runtime", value: `${fmtNum(row.total_pump_hours_h)} h` },
    { label: "Days with logs", value: fmtInt(row.days_logged) },
    { label: "Log entries", value: fmtInt(row.logs_count) },
    { label: "Average m³ per hour", value: fmtNum(row.avg_m3_per_hour) },
    { label: "Average m³ per logged day", value: fmtNum(row.avg_m3_per_day_logged) },
    { label: "Average hours per logged day", value: fmtNum(row.avg_hours_per_day_logged) },
  ];
}

export function solarSystemDetailFields(row: SolarSystemDetailRow) {
  return [
    { label: "Solar system ID", value: row.solar_system_id },
    { label: "Unique identifier", value: row.unique_identifier ?? "—" },
    { label: "Tehsil", value: row.tehsil },
    { label: "Village", value: row.village },
    { label: "Settlement", value: row.settlement ?? "—" },
    { label: "DISCO", value: row.disco_info ?? "—" },
    { label: "Bill reference", value: row.bill_reference_number ?? "—" },
    { label: "Total export", value: `${fmtInt(row.total_export_kwh)} kWh` },
    { label: "Total import", value: `${fmtInt(row.total_import_kwh)} kWh` },
    { label: "Total net", value: `${fmtInt(row.total_net_kwh)} kWh` },
    { label: "Months logged", value: fmtInt(row.months_logged) },
    { label: "Monthly records", value: fmtInt(row.records_count) },
    { label: "Avg export / month", value: `${fmtNum(row.avg_export_kwh_per_month)} kWh` },
    { label: "Avg import / month", value: `${fmtNum(row.avg_import_kwh_per_month)} kWh` },
    { label: "Avg net / month", value: `${fmtNum(row.avg_net_kwh_per_month)} kWh` },
  ];
}
