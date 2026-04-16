import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Building2, Clock, Droplets, Gauge, Sun, Zap } from "lucide-react";
import { useProgramDashboardApi } from "../../hooks";
import { getApiErrorMessage } from "../../lib/api-error";
import { LOCATION_DATA, TEHSIL_OPTIONS } from "../../utils/locationData";
import { useAuth } from "../../contexts/AuthContext";
import { isExecutiveRole } from "../../constants/roles";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Skeleton } from "../../components/ui/skeleton";
import SystemsMapCard from "./SystemsMapCard";

type SummaryData = {
  ohr_count: number;
  solar_facilities: number;
  bulk_meters: number;
};
type RowData = {
  month: number;
  total_water_pumped?: number;
  pump_operating_hours?: number;
  solar_generation_kwh?: number;
  grid_import_kwh?: number;
};

const YEARS = [2025, 2026, 2027, 2028, 2029];
const MONTHS = [
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
];

function formatTooltipNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(
    n,
  );
}

function formatKpiValue(n: number): string {
  if (!Number.isFinite(n) || Math.abs(n) < 1e-9) return "0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    return new Intl.NumberFormat(undefined, {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  }
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
    n,
  );
}

/** Map API rows (each has `month` 1–12) into 12 slots so charts stay correct if order changes. */
function seriesByMonth<T extends { month: number }>(
  rows: T[],
  pick: (r: T) => number,
): number[] {
  const out = Array.from({ length: 12 }, () => 0);
  for (const r of rows) {
    const m = r.month;
    if (m >= 1 && m <= 12) out[m - 1] = pick(r);
  }
  return out;
}

type ProgramDashboardProps = {
  headingTitle?: string;
  headingDescription?: string;
  /** When true, show a short plain-language note for programme / field leads. */
  managementView?: boolean;
  /** Executive layout: show map before KPI sections. */
  mapPosition?: "top" | "inline";
};

const ProgramDashboard = ({
  headingTitle = "Program Dashboard",
  headingDescription = "Water and solar performance by area and time period.",
  managementView = true,
  mapPosition = "inline",
}: ProgramDashboardProps) => {
  const { user } = useAuth();
  const showSystemsMap = isExecutiveRole(user?.role);
  const {
    getDashboardProgramSummary,
    getDashboardWaterSupplied,
    getDashboardPumpHours,
    getDashboardSolarGeneration,
    getDashboardGridImport,
  } = useProgramDashboardApi();

  const [filters, setFilters] = useState({
    tehsil: "All Tehsils",
    village: "All Villages",
    month: "All Months",
    year: "2026",
  });
  const [activeFilters, setActiveFilters] = useState(filters);
  const [summary, setSummary] = useState<SummaryData>({
    ohr_count: 0,
    solar_facilities: 0,
    bulk_meters: 0,
  });
  const [waterSupplied, setWaterSupplied] = useState<RowData[]>([]);
  const [pumpHours, setPumpHours] = useState<RowData[]>([]);
  const [solarGeneration, setSolarGeneration] = useState<RowData[]>([]);
  const [gridImport, setGridImport] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const villageOptions = useMemo(() => {
    if (filters.tehsil === "All Tehsils") return ["All Villages"];
    return [
      "All Villages",
      ...((LOCATION_DATA[filters.tehsil.toUpperCase()] || []) as string[]),
    ];
  }, [filters.tehsil]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const apiFilters = {
          tehsil: activeFilters.tehsil,
          village: activeFilters.village,
          year: Number(activeFilters.year),
          ...(activeFilters.month !== "All Months"
            ? { month: Number(activeFilters.month) }
            : {}),
        };
        const [sum, water, pump, solar, grid] = await Promise.all([
          getDashboardProgramSummary(apiFilters),
          getDashboardWaterSupplied(apiFilters),
          getDashboardPumpHours(apiFilters),
          getDashboardSolarGeneration(apiFilters),
          getDashboardGridImport(apiFilters),
        ]);
        setSummary((sum || {}) as SummaryData);
        setWaterSupplied((water || []) as RowData[]);
        setPumpHours((pump || []) as RowData[]);
        setSolarGeneration((solar || []) as RowData[]);
        setGridImport((grid || []) as RowData[]);
      } catch (err) {
        setError(getApiErrorMessage(err, "Failed to load program dashboard"));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [activeFilters]);

  const activeScopeLabel = useMemo(() => {
    const tehsil =
      activeFilters.tehsil === "All Tehsils" ? "All tehsils" : activeFilters.tehsil;
    const village =
      activeFilters.village === "All Villages" ? "All villages" : activeFilters.village;
    const month =
      activeFilters.month === "All Months"
        ? "All months"
        : MONTHS[Number(activeFilters.month) - 1];
    return `${tehsil} · ${village} · ${activeFilters.year} · ${month}`;
  }, [activeFilters]);

  const activeScopeTooltip = useMemo(() => {
    const tehsilPart =
      activeFilters.tehsil === "All Tehsils" ? "All tehsils" : activeFilters.tehsil;
    if (activeFilters.village === "All Villages") {
      return activeFilters.tehsil === "All Tehsils"
        ? "All villages"
        : `All villages · ${tehsilPart}`;
    }
    return `${activeFilters.village} · ${tehsilPart}`;
  }, [activeFilters.tehsil, activeFilters.village]);

  const waterByMonth = useMemo(
    () =>
      seriesByMonth(waterSupplied as RowData[], (r) =>
        Number(r.total_water_pumped ?? 0),
      ),
    [waterSupplied],
  );
  const pumpByMonth = useMemo(
    () =>
      seriesByMonth(pumpHours as RowData[], (r) =>
        Number(r.pump_operating_hours ?? 0),
      ),
    [pumpHours],
  );
  const solarByMonth = useMemo(
    () =>
      seriesByMonth(solarGeneration as RowData[], (r) =>
        Number(r.solar_generation_kwh ?? 0),
      ),
    [solarGeneration],
  );
  const gridByMonth = useMemo(
    () =>
      seriesByMonth(gridImport as RowData[], (r) =>
        Number(r.grid_import_kwh ?? 0),
      ),
    [gridImport],
  );

  const periodTotals = useMemo(
    () => ({
      waterM3: waterByMonth.reduce((a, b) => a + b, 0),
      pumpH: pumpByMonth.reduce((a, b) => a + b, 0),
      solarKwh: solarByMonth.reduce((a, b) => a + b, 0),
      gridKwh: gridByMonth.reduce((a, b) => a + b, 0),
    }),
    [waterByMonth, pumpByMonth, solarByMonth, gridByMonth],
  );

  const meterCoveragePct = useMemo(() => {
    const total = summary.ohr_count;
    if (!total) return null;
    return Math.round((100 * summary.bulk_meters) / total);
  }, [summary.ohr_count, summary.bulk_meters]);

  const ytdWaterSeries = useMemo(() => {
    let acc = 0;
    return waterByMonth.map((v) => {
      acc += v;
      return acc;
    });
  }, [waterByMonth]);

  const waterVolumeChartData = useMemo(
    () =>
      MONTHS.map((m, i) => ({
        month: m,
        monthly: waterByMonth[i] ?? 0,
        ytd: ytdWaterSeries[i] ?? 0,
      })),
    [waterByMonth, ytdWaterSeries],
  );

  const pumpOnlyChartData = useMemo(
    () =>
      MONTHS.map((m, i) => ({
        month: m,
        value: pumpByMonth[i] ?? 0,
      })),
    [pumpByMonth],
  );

  const waterPumpCombinedChartData = useMemo(
    () =>
      MONTHS.map((m, i) => ({
        month: m,
        waterM3: waterByMonth[i] ?? 0,
        pumpH: pumpByMonth[i] ?? 0,
      })),
    [waterByMonth, pumpByMonth],
  );

  const solarProgramChartData = useMemo(
    () =>
      MONTHS.map((m, i) => ({
        month: m,
        solarKwh: solarByMonth[i] ?? 0,
        gridKwh: gridByMonth[i] ?? 0,
      })),
    [solarByMonth, gridByMonth],
  );

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            {headingTitle}
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {headingDescription}
          </p>
        </div>

        {managementView ? (
          <p className="max-w-3xl border-l-2 border-primary/35 pl-4 text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Note:</span> Water is
            aggregated from daily logs; solar is aggregated from monthly site
            records.
          </p>
        ) : null}

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filters</CardTitle>
            <CardDescription>
              Select tehsil, village, year (optional month refines totals).
            </CardDescription>
            <p className="pt-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Showing:</span>{" "}
              {activeScopeLabel}
            </p>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <Select
              value={filters.tehsil}
              onValueChange={(v) =>
                setFilters((prev) => ({
                  ...prev,
                  tehsil: v ?? prev.tehsil,
                  village: "All Villages",
                }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["All Tehsils", ...TEHSIL_OPTIONS].map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.village}
              onValueChange={(v) =>
                setFilters((prev) => ({ ...prev, village: v ?? prev.village }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {villageOptions.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.month}
              onValueChange={(v) =>
                setFilters((prev) => ({ ...prev, month: v ?? prev.month }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All Months">All Months</SelectItem>
                {MONTHS.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.year}
              onValueChange={(v) =>
                setFilters((prev) => ({ ...prev, year: v ?? prev.year }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => setActiveFilters(filters)}
              className="w-full"
            >
              Apply Filters
            </Button>
          </CardContent>
        </Card>

        {error ? (
          <Card>
            <CardContent className="pt-6 text-sm text-destructive">
              {error}
            </CardContent>
          </Card>
        ) : null}

        {showSystemsMap && mapPosition === "top" ? (
          <SystemsMapCard
            mapFilters={{
              tehsil: activeFilters.tehsil,
              village: activeFilters.village,
            }}
            summaryCounts={
              loading
                ? null
                : { water: summary.ohr_count, solar: summary.solar_facilities }
            }
          />
        ) : null}

        <div className="space-y-3">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Sites on programme
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Card className="border-border/70 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Building2 className="size-3.5 text-blue-600" />
                  OHR Water Systems
                </CardDescription>
                <CardTitle className="font-heading text-3xl tabular-nums">
                  {loading ? (
                    <Skeleton className="h-9 w-24" />
                  ) : (
                    formatKpiValue(summary.ohr_count)
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground">
                  Water systems in scope.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Sun className="size-3.5 text-amber-600" />
                  Solar facilities
                </CardDescription>
                <CardTitle className="font-heading text-3xl tabular-nums">
                  {loading ? (
                    <Skeleton className="h-9 w-24" />
                  ) : (
                    formatKpiValue(summary.solar_facilities)
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground">
                  Solar sites in scope.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Totals for this selection
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="bg-card shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Droplets className="size-3.5 text-blue-600" />
                  Water delivered
                </CardDescription>
                <CardTitle className="font-heading text-2xl tabular-nums sm:text-3xl">
                  {loading ? (
                    <Skeleton className="h-8 w-28" />
                  ) : (
                    `${formatKpiValue(periodTotals.waterM3)} m³`
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground">
                  Water volume (m³).
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Clock className="size-3.5 text-sky-600" />
                  Pump run time
                </CardDescription>
                <CardTitle className="font-heading text-2xl tabular-nums sm:text-3xl">
                  {loading ? (
                    <Skeleton className="h-8 w-28" />
                  ) : (
                    `${formatKpiValue(periodTotals.pumpH)} h`
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground">
                  Pump runtime (h).
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Sun className="size-3.5 text-amber-600" />
                  Solar to grid
                </CardDescription>
                <CardTitle className="font-heading text-2xl tabular-nums sm:text-3xl">
                  {loading ? (
                    <Skeleton className="h-8 w-28" />
                  ) : (
                    `${formatKpiValue(periodTotals.solarKwh)} kWh`
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground">
                  Exported to grid.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Zap className="size-3.5 text-red-600" />
                  Grid electricity used
                </CardDescription>
                <CardTitle className="font-heading text-2xl tabular-nums sm:text-3xl">
                  {loading ? (
                    <Skeleton className="h-8 w-28" />
                  ) : (
                    `${formatKpiValue(periodTotals.gridKwh)} kWh`
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground">
                  Imported from grid.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {showSystemsMap && mapPosition === "inline" ? (
          <SystemsMapCard
            mapFilters={{
              tehsil: activeFilters.tehsil,
              village: activeFilters.village,
            }}
            summaryCounts={
              loading
                ? null
                : { water: summary.ohr_count, solar: summary.solar_facilities }
            }
          />
        ) : null}

        <div className="space-y-3">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Year view ({activeFilters.year})
          </h2>
          <div className="flex flex-col gap-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Water programme</CardTitle>
                <CardDescription>
                  Monthly totals from daily logs (m³ and pump hours).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8 overflow-x-auto">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Water pumped (m³) and pump run (h) — monthly
                  </p>
                  <div className="h-[340px] min-w-[680px] w-full">
                    {loading ? (
                      <Skeleton className="h-full w-full" />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={waterPumpCombinedChartData}
                          barCategoryGap={12}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                          <YAxis
                            yAxisId="left"
                            tick={{ fontSize: 11 }}
                            tickFormatter={(v) => formatKpiValue(Number(v))}
                            label={{
                              value: "m³",
                              angle: -90,
                              position: "insideLeft",
                              style: { fontSize: 11, fill: "#64748b" },
                            }}
                          />
                          <YAxis
                            yAxisId="right"
                            orientation="right"
                            tick={{ fontSize: 11 }}
                            tickFormatter={(v) => formatKpiValue(Number(v))}
                            label={{
                              value: "h",
                              angle: 90,
                              position: "insideRight",
                              style: { fontSize: 11, fill: "#64748b" },
                            }}
                          />
                          <Tooltip
                            labelFormatter={(label) =>
                              `${String(label)} · ${activeScopeTooltip}`
                            }
                            formatter={(value, name) => {
                              const n = Number(value ?? 0);
                              if (name === "Water pumped") {
                                return [`${formatTooltipNumber(n)} m³`, name];
                              }
                              if (name === "Pump run time") {
                                return [`${formatTooltipNumber(n)} h`, name];
                              }
                              return [formatTooltipNumber(n), String(name)];
                            }}
                          />
                          <Legend />
                          <Bar
                            yAxisId="left"
                            dataKey="waterM3"
                            name="Water pumped"
                            fill="#3b82f6"
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar
                            yAxisId="right"
                            dataKey="pumpH"
                            name="Pump run time"
                            fill="#0ea5e9"
                            radius={[4, 4, 0, 0]}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Solar programme</CardTitle>
                <CardDescription>
                  Monthly energy (kWh): export vs import.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <div className="h-[320px] min-w-[680px] w-full">
                  {loading ? (
                    <Skeleton className="h-full w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={solarProgramChartData} barCategoryGap={12}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v) => formatKpiValue(Number(v))}
                          label={{
                            value: "kWh",
                            angle: -90,
                            position: "insideLeft",
                            style: { fontSize: 11, fill: "#64748b" },
                          }}
                        />
                        <Tooltip
                          labelFormatter={(label) =>
                            `${String(label)} · ${activeScopeTooltip}`
                          }
                          formatter={(value, name) => [
                            `${formatTooltipNumber(Number(value ?? 0))} kWh`,
                            String(name),
                          ]}
                        />
                        <Legend />
                        <Bar
                          dataKey="solarKwh"
                          name="Solar to grid"
                          fill="#d97706"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="gridKwh"
                          name="Grid power used"
                          fill="#ef4444"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgramDashboard;
