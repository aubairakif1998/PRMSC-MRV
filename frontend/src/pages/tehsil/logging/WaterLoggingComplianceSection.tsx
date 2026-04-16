import { useMemo } from "react";
import { Download, Loader2, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "../../../components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Label } from "../../../components/ui/label";
import { Separator } from "../../../components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { tehsilRoutes } from "../../../constants/routes";
import { Button } from "../../../components/ui/button";
import { cn } from "../../../lib/utils";
import { downloadWaterComplianceExcel } from "./exportComplianceExcel";
import {
  type WaterDailyRangeDay,
  type WaterDailyRangePayload,
  type WaterSystemListItem,
  formatAssignedOperators,
  formatAssignedOperatorsTitle,
  waterStatusLabel,
  waterStatusVariant,
} from "./loggingComplianceTypes";
type WaterLoggingComplianceSectionProps = {
  baseId: string;
  panelId: string;
  waterSystems: WaterSystemListItem[];
  systemsLoading: boolean;
  selectedWaterSystemId: string;
  onSelectWaterSystem: (id: string) => void;
  rangeDays: 7 | 14 | 30;
  onRangeDaysChange: (days: 7 | 14 | 30) => void;
  loading: boolean;
  rangeData: WaterDailyRangePayload | null;
  weekChunks: WaterDailyRangeDay[][];
  activeWeekIndex: number;
  onActiveWeekIndexChange: (index: number) => void;
  visibleDays: WaterDailyRangeDay[];
};

function formatDayLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function shortDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function weekChunkLabel(chunk: WaterDailyRangeDay[]): string {
  if (chunk.length === 0) return "";
  const a = chunk[0]?.date;
  const b = chunk[chunk.length - 1]?.date;
  if (!a || !b) return "";
  return `${shortDate(a)} – ${shortDate(b)}`;
}

function countStatuses(days: WaterDailyRangeDay[]) {
  const counts: Record<string, number> = {};
  for (const row of days) {
    const k = row.daily_status;
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

function StepIndex({ n }: { n: number }) {
  return (
    <span
      className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-xs font-semibold tabular-nums text-muted-foreground"
      aria-hidden
    >
      {n}
    </span>
  );
}

export default function WaterLoggingComplianceSection({
  baseId,
  panelId,
  waterSystems,
  systemsLoading,
  selectedWaterSystemId,
  onSelectWaterSystem,
  rangeDays,
  onRangeDaysChange,
  loading,
  rangeData,
  weekChunks,
  activeWeekIndex,
  onActiveWeekIndexChange,
  visibleDays,
}: WaterLoggingComplianceSectionProps) {
  const navigate = useNavigate();

  const weekStats = useMemo(() => countStatuses(visibleDays), [visibleDays]);

  const selectedSystem = waterSystems.find((s) => s.id === selectedWaterSystemId);
  const operatorsForTable = rangeData?.assigned_operators;
  const opsText = formatAssignedOperators(operatorsForTable);
  const opsTitle = formatAssignedOperatorsTitle(operatorsForTable);
  const showOps = opsText.trim() !== "";

  const rangePresets: { days: 7 | 14 | 30; label: string }[] = [
    { days: 7, label: "7 days" },
    { days: 14, label: "14 days" },
    { days: 30, label: "30 days" },
  ];

  const totalWeekParts = weekChunks.length;

  return (
    <div
      id={panelId}
      role="tabpanel"
      aria-labelledby={`${baseId}-tab-water`}
      className="w-full space-y-6"
    >
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 pt-6">
          <CardTitle className="text-base font-medium">Selection</CardTitle>
          <CardDescription className="text-sm">
            Choose a system first. The window ends today and counts backward.
            Results refresh when inputs change.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-0 pb-6">
          <div className="flex gap-4">
            <StepIndex n={1} />
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="water-system-pick" className="text-sm font-medium">
                Water system
              </Label>
              <Select
                value={selectedWaterSystemId || undefined}
                onValueChange={(v) => {
                  if (v != null) onSelectWaterSystem(v);
                }}
                disabled={systemsLoading || waterSystems.length === 0}
              >
                <SelectTrigger
                  id="water-system-pick"
                  className="h-10 max-w-lg"
                  aria-describedby={`${baseId}-step1-hint`}
                >
                  <SelectValue
                    placeholder={
                      systemsLoading ? "Loading…" : "Select system"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {waterSystems.map((ws) => (
                    <SelectItem key={ws.id} value={ws.id}>
                      <span className="font-mono text-sm">{ws.unique_identifier}</span>
                      <span className="text-muted-foreground"> — {ws.village}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p id={`${baseId}-step1-hint`} className="sr-only">
                Water system to review daily logs for.
              </p>
            </div>
          </div>

          <Separator className="my-6" />

          <div className="flex gap-4">
            <StepIndex n={2} />
            <div className="min-w-0 flex-1 space-y-3">
              <span className="text-sm font-medium">Date range</span>
              <div className="flex flex-wrap gap-2">
                {rangePresets.map(({ days, label }) => (
                  <Button
                    key={days}
                    type="button"
                    variant={rangeDays === days ? "secondary" : "outline"}
                    size="sm"
                    className="min-w-[5.5rem] font-normal"
                    onClick={() => onRangeDaysChange(days)}
                    disabled={loading || !selectedWaterSystemId}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {totalWeekParts > 1 ? (
            <>
              <Separator className="my-6" />
              <div className="flex gap-4">
                <StepIndex n={3} />
                <div className="min-w-0 flex-1 space-y-2">
                  <Label htmlFor="water-week-chunk" className="text-sm font-medium">
                    Segment
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Up to seven days per segment, chronological order.
                  </p>
                  <Select
                    value={String(activeWeekIndex)}
                    onValueChange={(v) => {
                      if (v != null) onActiveWeekIndexChange(Number(v));
                    }}
                    disabled={loading || weekChunks.length === 0}
                  >
                    <SelectTrigger id="water-week-chunk" className="h-10 max-w-lg">
                      <SelectValue placeholder="Select segment" />
                    </SelectTrigger>
                    <SelectContent>
                      {weekChunks.map((chunk, idx) => (
                        <SelectItem key={idx} value={String(idx)}>
                          {idx + 1} / {totalWeekParts} · {weekChunkLabel(chunk)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {systemsLoading ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading systems…
        </div>
      ) : null}

      {!systemsLoading &&
      waterSystems.length > 0 &&
      !selectedWaterSystemId ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <MapPin className="size-8 text-muted-foreground/60" />
            <p className="text-sm font-medium text-foreground">
              Select a water system
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Pick a site above to load daily logging and show the table.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {!systemsLoading && waterSystems.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <MapPin className="size-8 text-muted-foreground/60" />
            <p className="text-sm font-medium text-foreground">
              No water systems in scope
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Register systems under Water systems, then return here.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {loading && !rangeData && selectedWaterSystemId ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </div>
      ) : null}

      {rangeData && selectedWaterSystemId ? (
        <>
          <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-mono font-medium text-foreground">
                {rangeData.unique_identifier}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                {selectedSystem?.settlement
                  ? `${selectedSystem.village}, ${selectedSystem.settlement}`
                  : rangeData.village}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {rangeData.date_from} — {rangeData.date_to} · {rangeDays} days
              {totalWeekParts > 1
                ? ` · Segment ${activeWeekIndex + 1} of ${totalWeekParts} · ${visibleDays.length} day(s) shown`
                : ` · ${visibleDays.length} day(s) shown`}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="border-border shadow-none">
              <CardHeader className="pb-1 pt-4">
                <CardDescription className="text-xs font-normal text-muted-foreground">
                  Missing
                </CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums text-destructive">
                  {weekStats.missing ?? 0}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4 text-xs text-muted-foreground">
                No entry for that day
              </CardContent>
            </Card>
            <Card className="border-border shadow-none">
              <CardHeader className="pb-1 pt-4">
                <CardDescription className="text-xs font-normal text-muted-foreground">
                  Draft
                </CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums">
                  {weekStats.draft ?? 0}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4 text-xs text-muted-foreground">
                Not submitted
              </CardContent>
            </Card>
            <Card className="border-border shadow-none">
              <CardHeader className="pb-1 pt-4">
                <CardDescription className="text-xs font-normal text-muted-foreground">
                  Submitted / approved
                </CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums text-foreground">
                  {(weekStats.submitted ?? 0) + (weekStats.accepted ?? 0)}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4 text-xs text-muted-foreground">
                In review or accepted
              </CardContent>
            </Card>
          </div>

          <Card className="border-border shadow-none">
            <CardHeader className="border-b border-border/80 pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <CardTitle className="text-base font-medium">Daily detail</CardTitle>
                  <CardDescription className="text-sm">
                    <button
                      type="button"
                      className="text-foreground underline-offset-4 hover:underline"
                      onClick={() => navigate(tehsilRoutes.waterSubmissions)}
                    >
                      Submissions
                    </button>{" "}
                    for formal review. Export matches the table: same columns
                    and the current segment when the period is split into weeks.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-2"
                  disabled={visibleDays.length === 0}
                  onClick={() =>
                    downloadWaterComplianceExcel(
                      rangeData,
                      weekChunks.length > 1
                        ? {
                            tableDays: visibleDays,
                            segmentIndex: activeWeekIndex + 1,
                            segmentCount: weekChunks.length,
                          }
                        : { tableDays: visibleDays },
                    )
                  }
                >
                  <Download className="size-4" />
                  Export Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0 sm:p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="min-w-[200px] pl-6">Date</TableHead>
                    <TableHead className="min-w-[160px]">Status</TableHead>
                    <TableHead className="min-w-[180px] pr-6">Operators</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleDays.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="py-10 text-center text-muted-foreground"
                      >
                        No rows for this segment.
                      </TableCell>
                    </TableRow>
                  ) : (
                    visibleDays.map((row) => (
                      <TableRow key={row.date}>
                        <TableCell className="align-top pl-6">
                          <div className="text-sm font-medium leading-tight">
                            {formatDayLabel(row.date)}
                          </div>
                          <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                            {row.date}
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge
                            variant={waterStatusVariant(row.daily_status)}
                            className="whitespace-normal text-left font-normal"
                          >
                            {waterStatusLabel(row.daily_status)}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={cn(
                            "max-w-[360px] align-top text-sm pr-6",
                            showOps
                              ? "text-foreground"
                              : "text-muted-foreground",
                          )}
                          title={opsTitle}
                        >
                          {showOps ? (
                            <span className="line-clamp-3">{opsText}</span>
                          ) : (
                            <span className="italic">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
