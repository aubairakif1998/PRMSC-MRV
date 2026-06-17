import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  Building2,
  Clock,
  Droplets,
  Gauge,
  SlidersHorizontal,
  Sun,
  Zap,
} from "lucide-react";
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
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "../../components/ui/chart";
import { Progress } from "../../components/ui/progress";
import { Skeleton } from "../../components/ui/skeleton";

type SummaryData = {
  ohr_count: number;
  solar_facilities: number;
  bulk_meters: number;
};

type ChartMonthRow = { month: string; [key: string]: string | number };

export type ScopeFilters = {
  tehsil: string;
  village: string;
  month: string;
  year: string;
};

type OrganizationKpiPanelProps = {
  loading: boolean;
  year: string;
  scopeLabel: string;
  scopeTooltip: string;
  summary: SummaryData;
  periodTotals: {
    waterM3: number;
    pumpH: number;
    solarKwh: number;
    gridKwh: number;
  };
  meterCoveragePct: number | null;
  waterVolumeChartData: ChartMonthRow[];
  pumpOnlyChartData: ChartMonthRow[];
  solarProgramChartData: ChartMonthRow[];
  formatKpiValue: (n: number) => string;
  formatTooltipNumber: (n: number) => string;
  /** Compact map rendered beside the footprint panel. */
  mapSlot?: React.ReactNode;
  scopeFilters?: ScopeFilters;
  onScopeChange?: (patch: Partial<ScopeFilters>) => void;
  villageOptions?: string[];
  allowedTehsils?: string[];
  restrictTehsils?: boolean;
  scopeFilterYears?: number[];
  scopeFilterMonths?: string[];
};

const portfolioConfig = {
  water: { label: "Tube wells", color: "#2563eb" },
  solar: { label: "Solar sites", color: "#d97706" },
} satisfies ChartConfig;

const waterDeliveryConfig = {
  monthly: { label: "Monthly delivery", color: "#3b82f6" },
  ytd: { label: "Year-to-date", color: "#1d4ed8" },
} satisfies ChartConfig;

const pumpRuntimeConfig = {
  value: { label: "Pump hours", color: "#0ea5e9" },
} satisfies ChartConfig;

const solarEnergyConfig = {
  solarKwh: { label: "Solar export", color: "#d97706" },
  gridKwh: { label: "Grid import", color: "#ef4444" },
} satisfies ChartConfig;

function KpiTile({
  icon: Icon,
  iconClass,
  label,
  value,
  unit,
  hint,
  loading,
  accent,
}: {
  icon: typeof Droplets;
  iconClass: string;
  label: string;
  value: string;
  unit?: string;
  hint: string;
  loading: boolean;
  accent: string;
}) {
  return (
    <Card className="relative overflow-hidden border-border/60 shadow-sm">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1"
        style={{ background: accent }}
      />
      <CardHeader className="pb-2 pt-5">
        <CardDescription className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span
            className={`flex size-7 items-center justify-center rounded-lg bg-muted/80 ${iconClass}`}
          >
            <Icon className="size-4" />
          </span>
          {label}
        </CardDescription>
        <CardTitle className="font-heading text-2xl tabular-nums sm:text-3xl">
          {loading ? (
            <Skeleton className="h-8 w-32" />
          ) : (
            <>
              {value}
              {unit ? (
                <span className="ml-1 text-lg font-medium text-muted-foreground">
                  {unit}
                </span>
              ) : null}
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function ScopeFilterControls({
  filters,
  onChange,
  villageOptions,
  allowedTehsils,
  restrictTehsils,
  years,
  months,
  scopeLabel,
}: {
  filters: ScopeFilters;
  onChange: (patch: Partial<ScopeFilters>) => void;
  villageOptions: string[];
  allowedTehsils: string[];
  restrictTehsils: boolean;
  years: number[];
  months: string[];
  scopeLabel: string;
}) {
  const tehsilOptions = restrictTehsils
    ? allowedTehsils
    : ["All Tehsils", ...allowedTehsils];

  return (
    <div className="space-y-2 rounded-xl border border-border/50 bg-gradient-to-r from-background via-background to-muted/30 p-3 md:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <SlidersHorizontal className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Programme scope
            </p>
            <p className="text-xs text-muted-foreground">
              Map, site mix, and KPI totals update together when you change
              filters.
            </p>
          </div>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 lg:max-w-3xl">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Tehsil
            </label>
            <Select
              value={filters.tehsil}
              onValueChange={(v) => onChange({ tehsil: v ?? filters.tehsil })}
            >
              <SelectTrigger className="h-9 w-full bg-background text-xs">
                <SelectValue placeholder="Tehsil" />
              </SelectTrigger>
              <SelectContent>
                {tehsilOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Village
            </label>
            <Select
              value={filters.village}
              onValueChange={(v) => onChange({ village: v ?? filters.village })}
            >
              <SelectTrigger className="h-9 w-full bg-background text-xs">
                <SelectValue placeholder="Village" />
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
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Year
            </label>
            <Select
              value={filters.year}
              onValueChange={(v) => onChange({ year: v ?? filters.year })}
            >
              <SelectTrigger className="h-9 w-full bg-background text-xs">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Month
            </label>
            <Select
              value={filters.month}
              onValueChange={(v) => onChange({ month: v ?? filters.month })}
            >
              <SelectTrigger className="h-9 w-full bg-background text-xs">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All Months">All months</SelectItem>
                {months.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <p className="border-t border-border/40 pt-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Active view:</span>{" "}
        {scopeLabel}
        <span className="hidden sm:inline">
          {" "}
          · Site map & footprint use tehsil/village · Charts use year/month
        </span>
      </p>
    </div>
  );
}

const OrganizationKpiPanel = ({
  loading,
  year,
  scopeLabel,
  scopeTooltip,
  summary,
  periodTotals,
  meterCoveragePct,
  waterVolumeChartData,
  pumpOnlyChartData,
  solarProgramChartData,
  formatKpiValue,
  formatTooltipNumber,
  mapSlot,
  scopeFilters,
  onScopeChange,
  villageOptions = ["All Villages"],
  allowedTehsils = [],
  restrictTehsils = false,
  scopeFilterYears = [],
  scopeFilterMonths = [],
}: OrganizationKpiPanelProps) => {
  const totalSites = summary.ohr_count + summary.solar_facilities;
  const portfolioData = [
    { key: "water", name: "Tube wells", value: summary.ohr_count },
    { key: "solar", name: "Solar sites", value: summary.solar_facilities },
  ].filter((d) => d.value > 0);

  const waterShare =
    totalSites > 0 ? Math.round((100 * summary.ohr_count) / totalSites) : 0;
  const solarShare = totalSites > 0 ? 100 - waterShare : 0;

  return (
    <div className="space-y-4">
      {scopeFilters && onScopeChange ? (
        <ScopeFilterControls
          filters={scopeFilters}
          onChange={onScopeChange}
          villageOptions={villageOptions}
          allowedTehsils={allowedTehsils}
          restrictTehsils={restrictTehsils}
          years={scopeFilterYears}
          months={scopeFilterMonths}
          scopeLabel={scopeLabel}
        />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-12 xl:items-stretch">
        {mapSlot ? (
          <div className="flex min-h-[320px] xl:col-span-5">{mapSlot}</div>
        ) : null}

        <Card
          className={`flex flex-col overflow-hidden border-border/60 shadow-sm ${
            mapSlot ? "xl:col-span-7" : "xl:col-span-4"
          }`}
        >
          <CardHeader className="border-b border-border/50 bg-gradient-to-br from-slate-50 to-blue-50/40 pb-3 dark:from-slate-900/60 dark:to-blue-950/20">
            <CardTitle className="text-base">Programme footprint</CardTitle>
            <CardDescription>
              Site mix and meter coverage — synced with map for{" "}
              <span className="font-medium text-foreground">
                {scopeFilters?.tehsil === "All Tehsils"
                  ? "all tehsils"
                  : scopeFilters?.tehsil}
                {scopeFilters?.village && scopeFilters.village !== "All Villages"
                  ? ` · ${scopeFilters.village}`
                  : ""}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4 pt-4">
            <div
              className={`grid flex-1 gap-4 ${
                mapSlot ? "sm:grid-cols-2" : "sm:grid-cols-[1fr_auto] xl:grid-cols-1"
              }`}
            >
            <div className="flex flex-col items-center justify-center">
              {loading ? (
                <Skeleton className="size-36 rounded-full" />
              ) : totalSites === 0 ? (
                <div className="flex size-36 items-center justify-center rounded-full border border-dashed border-border text-sm text-muted-foreground">
                  No sites
                </div>
              ) : (
                <ChartContainer
                  config={portfolioConfig}
                  className="mx-auto aspect-square h-[160px] w-full max-w-[180px]"
                >
                  <PieChart>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          hideLabel
                          formatter={(value, name) => (
                            <span className="font-medium">
                              {String(name)}: {formatKpiValue(Number(value))}
                            </span>
                          )}
                        />
                      }
                    />
                    <Pie
                      data={portfolioData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={42}
                      outerRadius={62}
                      paddingAngle={portfolioData.length > 1 ? 3 : 0}
                      strokeWidth={2}
                    >
                      {portfolioData.map((entry) => (
                        <Cell
                          key={entry.key}
                          fill={
                            portfolioConfig[
                              entry.key as keyof typeof portfolioConfig
                            ].color
                          }
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              )}
              {!loading && totalSites > 0 ? (
                <div className="mt-2 text-center">
                  <p className="text-2xl font-semibold tabular-nums">
                    {formatKpiValue(totalSites)}
                  </p>
                  <p className="text-xs text-muted-foreground">total sites</p>
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="size-4 text-blue-600" />
                  <span>Tube wells</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">
                    {loading ? "—" : formatKpiValue(summary.ohr_count)}
                  </p>
                  {!loading && totalSites > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {waterShare}% of portfolio
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
                <div className="flex items-center gap-2 text-sm">
                  <Sun className="size-4 text-amber-600" />
                  <span>Solar sites</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">
                    {loading ? "—" : formatKpiValue(summary.solar_facilities)}
                  </p>
                  {!loading && totalSites > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {solarShare}% of portfolio
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="space-y-2 rounded-lg border border-border/60 px-3 py-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Gauge className="size-4 text-emerald-600" />
                    Bulk meter coverage
                  </span>
                  <span className="font-medium tabular-nums">
                    {loading || meterCoveragePct == null
                      ? "—"
                      : `${meterCoveragePct}%`}
                  </span>
                </div>
                {loading ? (
                  <Skeleton className="h-2 w-full" />
                ) : meterCoveragePct != null ? (
                  <Progress value={meterCoveragePct} className="h-2" />
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {loading
                    ? "Loading meter data…"
                    : `${formatKpiValue(summary.bulk_meters)} of ${formatKpiValue(summary.ohr_count)} tube wells`}
                </p>
              </div>
            </div>
            </div>
          </CardContent>
        </Card>

        {!mapSlot ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:col-span-8">
          <KpiTile
            loading={loading}
            icon={Droplets}
            iconClass="text-blue-600"
            label="Water delivered"
            value={formatKpiValue(periodTotals.waterM3)}
            unit="m³"
            hint="Interval volume from daily operator logs"
            accent="linear-gradient(90deg, #3b82f6, #60a5fa)"
          />
          <KpiTile
            loading={loading}
            icon={Clock}
            iconClass="text-sky-600"
            label="Pump runtime"
            value={formatKpiValue(periodTotals.pumpH)}
            unit="h"
            hint="Total operating hours in period"
            accent="linear-gradient(90deg, #0ea5e9, #38bdf8)"
          />
          <KpiTile
            loading={loading}
            icon={Sun}
            iconClass="text-amber-600"
            label="Solar export"
            value={formatKpiValue(periodTotals.solarKwh)}
            unit="kWh"
            hint="Energy exported to grid"
            accent="linear-gradient(90deg, #d97706, #fbbf24)"
          />
          <KpiTile
            loading={loading}
            icon={Zap}
            iconClass="text-red-600"
            label="Grid import"
            value={formatKpiValue(periodTotals.gridKwh)}
            unit="kWh"
            hint="Electricity drawn from grid"
            accent="linear-gradient(90deg, #ef4444, #f87171)"
          />
        </div>
        ) : null}
      </div>

      {mapSlot ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiTile
            loading={loading}
            icon={Droplets}
            iconClass="text-blue-600"
            label="Water delivered"
            value={formatKpiValue(periodTotals.waterM3)}
            unit="m³"
            hint="Interval volume from daily operator logs"
            accent="linear-gradient(90deg, #3b82f6, #60a5fa)"
          />
          <KpiTile
            loading={loading}
            icon={Clock}
            iconClass="text-sky-600"
            label="Pump runtime"
            value={formatKpiValue(periodTotals.pumpH)}
            unit="h"
            hint="Total operating hours in period"
            accent="linear-gradient(90deg, #0ea5e9, #38bdf8)"
          />
          <KpiTile
            loading={loading}
            icon={Sun}
            iconClass="text-amber-600"
            label="Solar export"
            value={formatKpiValue(periodTotals.solarKwh)}
            unit="kWh"
            hint="Energy exported to grid"
            accent="linear-gradient(90deg, #d97706, #fbbf24)"
          />
          <KpiTile
            loading={loading}
            icon={Zap}
            iconClass="text-red-600"
            label="Grid import"
            value={formatKpiValue(periodTotals.gridKwh)}
            unit="kWh"
            hint="Electricity drawn from grid"
            accent="linear-gradient(90deg, #ef4444, #f87171)"
          />
        </div>
      ) : null}

      <div>
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              Performance trends
            </h2>
            <p className="text-sm text-muted-foreground">
              Monthly breakdown for {year}
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Water delivery</CardTitle>
              <CardDescription>
                Monthly volume (m³) with cumulative year-to-date
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto pb-4">
              {loading ? (
                <Skeleton className="h-[280px] w-full" />
              ) : (
                <ChartContainer
                  config={waterDeliveryConfig}
                  className="h-[280px] min-w-[320px] w-full"
                >
                  <ComposedChart data={waterVolumeChartData}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis
                      yAxisId="left"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => formatKpiValue(Number(v))}
                      width={48}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => formatKpiValue(Number(v))}
                      width={48}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(label) =>
                            `${String(label)} · ${scopeTooltip}`
                          }
                          formatter={(value, name) => {
                            const n = Number(value ?? 0);
                            const label =
                              name === "monthly"
                                ? "Monthly delivery"
                                : "Year-to-date";
                            return [
                              `${formatTooltipNumber(n)} m³`,
                              label,
                            ];
                          }}
                        />
                      }
                    />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="monthly"
                      fill="var(--color-monthly)"
                      fillOpacity={0.22}
                      stroke="var(--color-monthly)"
                      strokeWidth={2}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="ytd"
                      stroke="var(--color-ytd)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                  </ComposedChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Pump runtime</CardTitle>
              <CardDescription>
                Monthly operating hours across tube wells
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto pb-4">
              {loading ? (
                <Skeleton className="h-[280px] w-full" />
              ) : (
                <ChartContainer
                  config={pumpRuntimeConfig}
                  className="h-[280px] min-w-[320px] w-full"
                >
                  <ComposedChart data={pumpOnlyChartData}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => formatKpiValue(Number(v))}
                      width={48}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(label) =>
                            `${String(label)} · ${scopeTooltip}`
                          }
                          formatter={(value) => [
                            `${formatTooltipNumber(Number(value ?? 0))} h`,
                            "Pump hours",
                          ]}
                        />
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      fill="var(--color-value)"
                      fillOpacity={0.25}
                      stroke="var(--color-value)"
                      strokeWidth={2}
                    />
                  </ComposedChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="mt-4 border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Solar energy balance</CardTitle>
            <CardDescription>
              Monthly grid export vs import (kWh)
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto pb-4">
            {loading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <ChartContainer
                config={solarEnergyConfig}
                className="h-[300px] min-w-[320px] w-full"
              >
                <BarChart data={solarProgramChartData} barGap={4}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatKpiValue(Number(v))}
                    width={52}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(label) =>
                          `${String(label)} · ${scopeTooltip}`
                        }
                        formatter={(value, name) => [
                          `${formatTooltipNumber(Number(value ?? 0))} kWh`,
                          name === "solarKwh" ? "Solar export" : "Grid import",
                        ]}
                      />
                    }
                  />
                  <Bar
                    dataKey="solarKwh"
                    fill="var(--color-solarKwh)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="gridKwh"
                    fill="var(--color-gridKwh)"
                    radius={[4, 4, 0, 0]}
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OrganizationKpiPanel;
