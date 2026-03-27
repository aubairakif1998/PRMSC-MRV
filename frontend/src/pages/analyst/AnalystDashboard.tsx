import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, CheckCircle2, FileCheck2, Gauge, Image as ImageIcon, Leaf, Sparkles } from "lucide-react";
import { useAnalystApi, useVerificationApi } from "../../hooks";
import { getApiErrorMessage } from "../../lib/api-error";
import { TEHSIL_OPTIONS, LOCATION_DATA } from "../../utils/locationData";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Skeleton } from "../../components/ui/skeleton";

type SummaryData = { ohr_count: number; solar_facilities: number; bulk_meters: number };
type VerificationStats = { pending_review?: number; approved?: number };
type EmissionSummary = { total_reduction_tco2?: number };
type DataRow = { month: number; total_water_pumped?: number; solar_generation_kwh?: number; grid_import_kwh?: number };

const YEARS = [2025, 2026, 2027, 2028, 2029];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const AnalystDashboard = () => {
  const navigate = useNavigate();
  const { getVerificationStats } = useVerificationApi();
  const {
    getEmissionsSummary,
    getDashboardProgramSummary,
    getDashboardWaterSupplied,
    getDashboardSolarGeneration,
    getDashboardGridImport,
  } = useAnalystApi();

  const [filters, setFilters] = useState({
    tehsil: "All Tehsils",
    village: "All Villages",
    year: "2026",
  });
  const [activeFilters, setActiveFilters] = useState(filters);
  const [summary, setSummary] = useState<SummaryData>({ ohr_count: 0, solar_facilities: 0, bulk_meters: 0 });
  const [verification, setVerification] = useState<VerificationStats>({});
  const [emissions, setEmissions] = useState<EmissionSummary>({});
  const [waterData, setWaterData] = useState<DataRow[]>([]);
  const [solarData, setSolarData] = useState<DataRow[]>([]);
  const [gridData, setGridData] = useState<DataRow[]>([]);
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
        };
        const [ver, emission, sum, water, solar, grid] = await Promise.all([
          getVerificationStats(),
          getEmissionsSummary(Number(activeFilters.year)),
          getDashboardProgramSummary(apiFilters),
          getDashboardWaterSupplied(apiFilters),
          getDashboardSolarGeneration(apiFilters),
          getDashboardGridImport(apiFilters),
        ]);
        setVerification((ver || {}) as VerificationStats);
        setEmissions((emission || {}) as EmissionSummary);
        setSummary((sum || {}) as SummaryData);
        setWaterData((water || []) as DataRow[]);
        setSolarData((solar || []) as DataRow[]);
        setGridData((grid || []) as DataRow[]);
      } catch (err) {
        setError(getApiErrorMessage(err, "Failed to load analyst dashboard"));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [activeFilters]);

  const chartData = MONTHS.map((m, i) => ({
    month: m,
    water: waterData[i]?.total_water_pumped || 0,
    solar: solarData[i]?.solar_generation_kwh || 0,
    grid: gridData[i]?.grid_import_kwh || 0,
  }));

  const quickActions = [
    { title: "Submissions Audit", description: "Review pending submissions", icon: FileCheck2, path: "/submissions" },
    { title: "Emission Dashboard", description: "View climate impact analytics", icon: Leaf, path: "/analyst/emissions" },
    { title: "Prediction Dashboard", description: "Run AI forecasting models", icon: Sparkles, path: "/analyst/prediction" },
    { title: "Program Dashboard", description: "Explore monthly KPI trends", icon: Gauge, path: "/analyst/program-dashboard" },
    { title: "Visual Verification", description: "Validate meter/bill evidence", icon: ImageIcon, path: "/verifications" },
  ];

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Analyst Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Operational oversight, verification progress, and climate performance.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
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
            <Select value={filters.year} onValueChange={(v) => setFilters((prev) => ({ ...prev, year: v ?? prev.year }))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setActiveFilters(filters)} className="w-full">Apply</Button>
          </CardContent>
        </Card>

        {error ? (
          <Card>
            <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader>
              <CardDescription>Pending Review</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <FileCheck2 className="size-5 text-amber-600" />
                {loading ? <Skeleton className="h-7 w-16" /> : verification.pending_review || 0}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Total Reduction</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Leaf className="size-5 text-emerald-600" />
                {loading ? <Skeleton className="h-7 w-24" /> : `${(emissions.total_reduction_tco2 || 0).toFixed(2)} tCO2`}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Water Facilities</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <CheckCircle2 className="size-5 text-blue-600" />
                {loading ? <Skeleton className="h-7 w-16" /> : summary.ohr_count}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Solar Facilities</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <CheckCircle2 className="size-5 text-amber-600" />
                {loading ? <Skeleton className="h-7 w-16" /> : summary.solar_facilities}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Access</CardTitle>
            <CardDescription>Navigate to major analyst workflows</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            {quickActions.map((item) => (
              <Button
                key={item.title}
                variant="outline"
                className="h-auto justify-start gap-3 px-3 py-3 text-left"
                onClick={() => navigate(item.path)}
              >
                <item.icon className="size-4" />
                <span>
                  <span className="block text-sm font-medium">{item.title}</span>
                  <span className="block text-xs text-muted-foreground">{item.description}</span>
                </span>
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="size-4" />
              Monthly Operations Snapshot
            </CardTitle>
            <CardDescription>Water pumped, solar generation, and grid import</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="h-[340px] min-w-[760px]">
              {loading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="water" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="solar" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="grid" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AnalystDashboard;
