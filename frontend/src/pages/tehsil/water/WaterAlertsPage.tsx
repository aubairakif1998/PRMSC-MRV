import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ChevronLeft, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Skeleton } from "../../../components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../../components/ui/accordion";
import { useAuth } from "../../../contexts/AuthContext";
import { tehsilRoutes } from "../../../constants/routes";
import { TEHSIL_OPTIONS, LOCATION_DATA } from "../../../utils/locationData";
import { getApiErrorMessage } from "../../../lib/api-error";
import { getWaterAnomalies } from "../../../services/tehsilManagerOperatorService";

function formatTooltipNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
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
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

type AnomalyItem = {
  water_system: {
    id: string;
    unique_identifier?: string;
    tehsil: string;
    village: string;
    settlement?: string | null;
    bulk_meter_installed: boolean;
  };
  anomalies: Array<{ date: string; code: string; severity: string; message: string }>;
  series: Array<{
    date: string;
    total_water_pumped?: number | null;
    status?: string | null;
    operator?: { id: string; name: string; email: string; phone?: string | null } | null;
  }>;
};

export default function WaterAlertsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const scopedTehsils = useMemo((): string[] => {
    const t = (user?.tehsils ?? []).filter(
      (x): x is string => typeof x === "string" && x.trim().length > 0,
    );
    return t.length > 0 ? t : [...TEHSIL_OPTIONS];
  }, [user?.tehsils]);

  const restrictTehsils = scopedTehsils.length > 0 && !(scopedTehsils.length > 1 && scopedTehsils.includes("All Tehsils"));

  const [filters, setFilters] = useState({
    tehsil: scopedTehsils.length === 1 ? (scopedTehsils[0] ?? "All Tehsils") : "All Tehsils",
    village: "All Villages",
    end_date: "",
  });

  const villageOptions = useMemo(() => {
    if (filters.tehsil === "All Tehsils") return ["All Villages"];
    return [
      "All Villages",
      ...((LOCATION_DATA[String(filters.tehsil).toUpperCase()] || []) as string[]),
    ];
  }, [filters.tehsil]);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AnomalyItem[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = (await getWaterAnomalies({
        tehsil: filters.tehsil,
        village: filters.village,
        ...(filters.end_date ? { end_date: filters.end_date } : {}),
        days: 4,
      })) as { items?: AnomalyItem[] };
      setItems(Array.isArray(res?.items) ? res.items : []);
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Failed to load anomalies"));
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flagged = useMemo(
    () => items.filter((x) => (x.anomalies?.length ?? 0) > 0),
    [items],
  );

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(tehsilRoutes.dashboard)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Anomalies tracking
              </h1>
              <p className="text-sm text-muted-foreground">
                Last 4 days scan. An anomaly is flagged when today’s water pumped is &gt;10% above or &gt;50% below the previous 3‑day average.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCcw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
            <CardDescription>Scope anomalies to tehsil and village.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div>
              <div className="mb-2 text-xs font-semibold text-muted-foreground">Tehsil</div>
              <Select
                value={filters.tehsil}
                onValueChange={(v) =>
                  setFilters((p) => ({
                    ...p,
                    tehsil: v ?? "All Tehsils",
                    village: "All Villages",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(scopedTehsils.length === 1 || restrictTehsils
                    ? scopedTehsils
                    : ["All Tehsils", ...scopedTehsils]
                  ).map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold text-muted-foreground">Village</div>
              <Select
                value={filters.village}
                onValueChange={(v) =>
                  setFilters((p) => ({ ...p, village: v ?? "All Villages" }))
                }
              >
                <SelectTrigger>
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
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold text-muted-foreground">
                End date (optional)
              </div>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters((p) => ({ ...p, end_date: e.target.value }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="md:col-span-3">
              <Button onClick={() => void load()} disabled={loading} className="w-full">
                Apply
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">Flagged systems</CardTitle>
              <Badge variant={flagged.length ? "destructive" : "outline"}>
                {flagged.length} anomaly(ies)
              </Badge>
            </div>
            <CardDescription>
              Shows only systems with anomalies under the current filter.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <Skeleton className="h-28 w-full" />
            ) : flagged.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No anomalies detected.
              </div>
            ) : (
              <div className="rounded-xl border border-border/70 bg-background">
                <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
                  <p className="text-sm font-semibold">Flagged systems</p>
                  <p className="text-xs text-muted-foreground">
                    Scroll for more · Expand a row for details
                  </p>
                </div>
                <div className="max-h-[520px] overflow-y-auto p-2">
                  <Accordion className="w-full">
                    {flagged.slice(0, 50).map((it) => {
                      const title = [
                        it.water_system.unique_identifier || it.water_system.id,
                        it.water_system.village,
                        it.water_system.tehsil,
                      ]
                        .filter(Boolean)
                        .join(" · ");
                      const lastOp =
                        [...(it.series ?? [])]
                          .reverse()
                          .find((p) => p.operator)?.operator ?? null;
                      const series = Array.isArray(it.series) ? it.series : [];
                      const anomalyDates = new Set(
                        (it.anomalies ?? []).map((a) => String(a.date)),
                      );
                      const avg3ByDate = new Map<string, number>();
                      for (let i = 3; i < series.length; i += 1) {
                        const cur = series[i];
                        const p1 = series[i - 1];
                        const p2 = series[i - 2];
                        const p3 = series[i - 3];
                        const v1 = Number(p1?.total_water_pumped ?? NaN);
                        const v2 = Number(p2?.total_water_pumped ?? NaN);
                        const v3 = Number(p3?.total_water_pumped ?? NaN);
                        if (
                          cur?.date &&
                          Number.isFinite(v1) &&
                          Number.isFinite(v2) &&
                          Number.isFinite(v3)
                        ) {
                          avg3ByDate.set(String(cur.date), (v1 + v2 + v3) / 3);
                        }
                      }
                      const chartData = series.map((p) => ({
                        date: p.date,
                        waterM3: Number(p.total_water_pumped ?? 0),
                        avg3: avg3ByDate.get(String(p.date)) ?? null,
                        anomaly: anomalyDates.has(String(p.date)),
                      }));

                      return (
                        <AccordionItem
                          key={it.water_system.id}
                          value={it.water_system.id}
                          className="rounded-lg border border-border/70 bg-card px-3"
                        >
                          <AccordionTrigger className="py-3 hover:no-underline">
                            <div className="flex w-full items-start justify-between gap-3 pr-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">{title}</p>
                                {lastOp ? (
                                  <p className="mt-1 truncate text-xs text-muted-foreground">
                                    Latest operator:{" "}
                                    <span className="font-medium text-foreground">
                                      {lastOp.name}
                                    </span>{" "}
                                    · {lastOp.email}
                                    {lastOp.phone ? ` · ${lastOp.phone}` : ""}
                                  </p>
                                ) : null}
                              </div>
                              <Badge variant="outline" className="shrink-0 text-xs">
                                {(it.anomalies?.length ?? 0)} anomaly(ies)
                              </Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-3">
                            <div className="grid gap-3 md:grid-cols-[1fr_380px] md:items-start">
                              <div>
                                <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                                  {(it.anomalies ?? []).slice(0, 6).map((a, idx) => (
                                    <li key={`${a.code}-${a.date}-${idx}`}>
                                      <span className="font-medium text-foreground">
                                        {a.date}
                                      </span>
                                      : {a.message}
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <div className="w-full">
                                <div className="flex items-center justify-between gap-2 pb-2">
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <AlertTriangle className="size-4 text-destructive" />
                                    Review
                                  </div>
                                  <Badge variant="outline" className="text-xs">
                                    Water pumped vs 3‑day avg
                                  </Badge>
                                </div>
                                <div className="h-[180px] w-full">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart
                                      data={chartData}
                                      margin={{ top: 10, right: 12, bottom: 6, left: 0 }}
                                    >
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                      <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 10 }}
                                        tickFormatter={(d) => String(d).slice(5)}
                                        interval={0}
                                      />
                                      <YAxis
                                        tick={{ fontSize: 10 }}
                                        tickFormatter={(v) => formatKpiValue(Number(v))}
                                        width={34}
                                      />
                                      <Tooltip
                                        labelFormatter={(label) => `Date: ${String(label)}`}
                                        formatter={(value, name) => {
                                          const n = Number(value ?? 0);
                                          if (name === "Water pumped") {
                                            return [`${formatTooltipNumber(n)} m³`, name];
                                          }
                                          if (name === "3‑day avg") {
                                            if (!Number.isFinite(n)) return ["—", name];
                                            return [`${formatTooltipNumber(n)} m³`, name];
                                          }
                                          return [formatTooltipNumber(n), String(name)];
                                        }}
                                      />
                                      <Line
                                        type="monotone"
                                        dataKey="waterM3"
                                        name="Water pumped"
                                        stroke="#2563eb"
                                        strokeWidth={2.25}
                                        dot={({ cx, cy, payload }) => {
                                          if (cx == null || cy == null) return null;
                                          const isAnom = Boolean((payload as any)?.anomaly);
                                          return (
                                            <circle
                                              cx={cx}
                                              cy={cy}
                                              r={4}
                                              fill={isAnom ? "#ef4444" : "#2563eb"}
                                              stroke="#ffffff"
                                              strokeWidth={1.5}
                                            />
                                          );
                                        }}
                                      />
                                      <Line
                                        type="monotone"
                                        dataKey="avg3"
                                        name="3‑day avg"
                                        stroke="#64748b"
                                        strokeWidth={2}
                                        strokeDasharray="5 4"
                                        dot={false}
                                        connectNulls={false}
                                      />
                                    </ComposedChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

