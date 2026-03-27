import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Building2, Sun, Zap } from "lucide-react";
import { useAnalystApi } from "../../hooks";
import { getApiErrorMessage } from "../../lib/api-error";
import { LOCATION_DATA, TEHSIL_OPTIONS } from "../../utils/locationData";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Skeleton } from "../../components/ui/skeleton";

type SummaryData = { ohr_count: number; solar_facilities: number; bulk_meters: number };
type RowData = {
  month: number;
  total_water_pumped?: number;
  pump_operating_hours?: number;
  solar_generation_kwh?: number;
  grid_import_kwh?: number;
};

const YEARS = [2025, 2026, 2027, 2028, 2029];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const ProgramDashboard = () => {
  const {
    getDashboardProgramSummary,
    getDashboardWaterSupplied,
    getDashboardPumpHours,
    getDashboardSolarGeneration,
    getDashboardGridImport,
  } = useAnalystApi();

  const [filters, setFilters] = useState({
    tehsil: "All Tehsils",
    village: "All Villages",
    month: "All Months",
    year: "2026",
  });
  const [activeFilters, setActiveFilters] = useState(filters);
  const [summary, setSummary] = useState<SummaryData>({ ohr_count: 0, solar_facilities: 0, bulk_meters: 0 });
  const [waterSupplied, setWaterSupplied] = useState<RowData[]>([]);
  const [pumpHours, setPumpHours] = useState<RowData[]>([]);
  const [solarGeneration, setSolarGeneration] = useState<RowData[]>([]);
  const [gridImport, setGridImport] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const villageOptions = useMemo(() => {
    if (filters.tehsil === "All Tehsils") return ["All Villages"];
    return ["All Villages", ...((LOCATION_DATA[filters.tehsil.toUpperCase()] || []) as string[])];
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
          ...(activeFilters.month !== "All Months" ? { month: Number(activeFilters.month) } : {}),
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

  const ytdWater = useMemo(() => {
    const sumByMonth: number[] = [];
    waterSupplied.forEach((row, idx) => {
      const prev = idx === 0 ? 0 : sumByMonth[idx - 1] || 0;
      sumByMonth.push(prev + (row.total_water_pumped || 0));
    });
    return sumByMonth;
  }, [waterSupplied]);

  const waterChartData = MONTHS.map((m, i) => ({
    month: m,
    monthly: waterSupplied[i]?.total_water_pumped || 0,
    ytd: ytdWater[i] || 0,
  }));
  const pumpChartData = MONTHS.map((m, i) => ({ month: m, value: pumpHours[i]?.pump_operating_hours || 0 }));
  const solarChartData = MONTHS.map((m, i) => ({ month: m, value: solarGeneration[i]?.solar_generation_kwh || 0 }));
  const gridChartData = MONTHS.map((m, i) => ({ month: m, value: gridImport[i]?.grid_import_kwh || 0 }));

  const renderChartCard = (
    title: string,
    description: string,
    data: Array<Record<string, number | string>>,
    key: string,
    color: string,
    line = false,
  ) => (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="h-[280px] min-w-[640px]">
          {loading ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {line ? (
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey={key} stroke={color} strokeWidth={2.5} />
                </LineChart>
              ) : (
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey={key} fill={color} radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Program Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Program-wide water, pump, solar, and grid metrics by location and period.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <Select value={filters.tehsil} onValueChange={(v) => setFilters((prev) => ({ ...prev, tehsil: v ?? prev.tehsil, village: "All Villages" }))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["All Tehsils", ...TEHSIL_OPTIONS].map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.village} onValueChange={(v) => setFilters((prev) => ({ ...prev, village: v ?? prev.village }))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {villageOptions.map((v) => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.month} onValueChange={(v) => setFilters((prev) => ({ ...prev, month: v ?? prev.month }))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All Months">All Months</SelectItem>
                {MONTHS.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.year} onValueChange={(v) => setFilters((prev) => ({ ...prev, year: v ?? prev.year }))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setActiveFilters(filters)} className="w-full">Apply Filters</Button>
          </CardContent>
        </Card>

        {error ? (
          <Card>
            <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>Water Infrastructure</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Building2 className="size-5 text-blue-600" />
                {loading ? <Skeleton className="h-7 w-20" /> : summary.ohr_count}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Solar Facilities</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Sun className="size-5 text-amber-600" />
                {loading ? <Skeleton className="h-7 w-20" /> : summary.solar_facilities}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Bulk Meters Installed</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Zap className="size-5 text-emerald-600" />
                {loading ? <Skeleton className="h-7 w-20" /> : summary.bulk_meters}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Water Supplied</CardTitle>
              <CardDescription>Monthly vs YTD cumulative (m3)</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <div className="h-[300px] min-w-[680px]">
                {loading ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={waterChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="monthly" fill="#3b82f6" />
                      <Line type="monotone" dataKey="ytd" stroke="#6366f1" strokeWidth={2.5} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {renderChartCard("Pump Operating Hours", "For non-meter sites", pumpChartData, "value", "#0ea5e9")}
          {renderChartCard("Solar Generation", "Exported energy to grid", solarChartData, "value", "#f59e0b")}
          {renderChartCard("Grid Import", "Energy consumed from grid", gridChartData, "value", "#ef4444")}
        </div>
      </div>
    </div>
  );
};

export default ProgramDashboard;
