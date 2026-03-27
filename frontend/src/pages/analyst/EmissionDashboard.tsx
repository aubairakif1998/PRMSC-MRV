/**
 * Emission Dashboard
 * ─────────────────
 * This page displays carbon emission reduction analytics.
 *
 * How React + Recharts works:
 *   1. useEffect() calls API functions on page load
 *   2. API returns JSON data → stored in state
 *   3. React re-renders → Recharts receives new data → charts animate
 *
 * Charts used:
 *   - BarChart: Monthly emission reduction (water vs solar)
 *   - PieChart: Water vs Solar contribution
 *   - BarChart (horizontal): Top performing systems
 *
 * Key MRV concepts displayed:
 *   - Total Emission Reduction (tCO₂)
 *   - Equivalent trees planted
 *   - Monthly trend showing climate impact over time
 *   - System comparison for identifying best performers
 */

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Leaf, Trees, Factory } from "lucide-react";
import { useAnalystApi } from "../../hooks";
import { getApiErrorMessage } from "../../lib/api-error";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Skeleton } from "../../components/ui/skeleton";

type EmissionSummary = {
  total_reduction_tco2?: number;
  water_reduction_tco2?: number;
  solar_reduction_tco2?: number;
  systems_calculated?: number;
  trees_equivalent?: number;
  emission_factor_used?: number;
};

type TrendPoint = {
  month: string;
  water_reduction_kg: number;
  solar_reduction_kg: number;
  total_reduction_kg: number;
};

type SystemPoint = {
  system: string;
  reduction_tco2: number;
};

const PIE_COLORS = ["#0ea5e9", "#f59e0b"];

const EmissionDashboard = () => {
  const { getEmissionsSummary, getEmissionsTrend, getSystemComparison } = useAnalystApi();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [summary, setSummary] = useState<EmissionSummary>({});
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [systems, setSystems] = useState<SystemPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const yearNum = Number(year);
        const [sum, trendRes, comparisonRes] = await Promise.all([
          getEmissionsSummary(yearNum),
          getEmissionsTrend(yearNum),
          getSystemComparison(yearNum),
        ]);
        setSummary((sum || {}) as EmissionSummary);
        setTrend((((trendRes as { trend?: TrendPoint[] })?.trend || []) as TrendPoint[]));
        setSystems((((comparisonRes as { systems?: SystemPoint[] })?.systems || []) as SystemPoint[]).slice(0, 10));
      } catch (err) {
        setError(getApiErrorMessage(err, "Failed to load emissions dashboard"));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [year]);

  const pieData = [
    { name: "Water", value: summary.water_reduction_tco2 || 0 },
    { name: "Solar", value: summary.solar_reduction_tco2 || 0 },
  ];

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Emission Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Emission reductions, trends, and top-performing systems.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Year</Badge>
            <Select value={year} onValueChange={(value) => value && setYear(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error ? (
          <Card>
            <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>Total Reduction</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Leaf className="size-5 text-emerald-600" />
                {loading ? <Skeleton className="h-7 w-24" /> : `${(summary.total_reduction_tco2 || 0).toFixed(2)} tCO2`}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Systems Calculated</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Factory className="size-5 text-blue-600" />
                {loading ? <Skeleton className="h-7 w-16" /> : summary.systems_calculated || 0}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Trees Equivalent</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Trees className="size-5 text-emerald-700" />
                {loading ? <Skeleton className="h-7 w-20" /> : (summary.trees_equivalent || 0).toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Reduction Trend (kg CO2)</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <div className="h-[320px] min-w-[640px]">
                {loading ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="water_reduction_kg" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="solar_reduction_kg" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Water vs Solar Share (tCO2)</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <div className="h-[320px] min-w-[500px]">
                {loading ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={110} innerRadius={65}>
                        {pieData.map((entry, index) => (
                          <Cell key={entry.name} fill={PIE_COLORS[index] || "#64748b"} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Top Systems by Reduction (tCO2)</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="h-[340px] min-w-[720px]">
              {loading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={systems} layout="vertical" margin={{ left: 24, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="system" width={220} />
                    <Tooltip />
                    <Bar dataKey="reduction_tco2" fill="#10b981" radius={[0, 4, 4, 0]} />
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

export default EmissionDashboard;
