import { useMemo } from "react";
import { Download, Loader2, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
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
import { downloadSolarComplianceExcel } from "./exportComplianceExcel";
import {
  MONTH_NAMES,
  type SolarMonthlyYearPayload,
  type SolarSystemListItem,
} from "./loggingComplianceTypes";

type SolarLoggingComplianceSectionProps = {
  baseId: string;
  panelId: string;
  solarSites: SolarSystemListItem[];
  sitesLoading: boolean;
  selectedSolarSystemId: string;
  onSelectSolarSystem: (id: string) => void;
  solarYear: number;
  onSolarYearChange: (y: number) => void;
  yearOptions: number[];
  loading: boolean;
  yearData: SolarMonthlyYearPayload | null;
};

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

export default function SolarLoggingComplianceSection({
  baseId,
  panelId,
  solarSites,
  sitesLoading,
  selectedSolarSystemId,
  onSelectSolarSystem,
  solarYear,
  onSolarYearChange,
  yearOptions,
  loading,
  yearData,
}: SolarLoggingComplianceSectionProps) {
  const navigate = useNavigate();

  const selectedSite = solarSites.find((s) => s.id === selectedSolarSystemId);

  const counts = useMemo(() => {
    const months = yearData?.months ?? [];
    let logged = 0;
    for (const m of months) {
      if (m.monthly_status === "logged") logged += 1;
    }
    return { logged, missing: 12 - logged };
  }, [yearData?.months]);

  return (
    <div
      id={panelId}
      role="tabpanel"
      aria-labelledby={`${baseId}-tab-solar`}
      className="w-full space-y-6"
    >
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 pt-6">
          <CardTitle className="text-base font-medium">Selection</CardTitle>
          <CardDescription className="text-sm">
            Select a solar site first, then a year. The table lists every month
            in that year.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-0 pb-6">
          <div className="flex gap-4">
            <StepIndex n={1} />
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="solar-site-pick" className="text-sm font-medium">
                Solar site
              </Label>
              <Select
                value={selectedSolarSystemId || undefined}
                onValueChange={(v) => {
                  if (v != null) onSelectSolarSystem(v);
                }}
                disabled={sitesLoading || solarSites.length === 0}
              >
                <SelectTrigger id="solar-site-pick" className="h-10 max-w-lg">
                  <SelectValue
                    placeholder={sitesLoading ? "Loading…" : "Select site"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {solarSites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="font-mono text-sm">{s.unique_identifier}</span>
                      <span className="text-muted-foreground"> — {s.village}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator className="my-6" />

          <div className="flex gap-4">
            <StepIndex n={2} />
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="solar-year-pick" className="text-sm font-medium">
                Year
              </Label>
              <Select
                value={String(solarYear)}
                onValueChange={(v) => {
                  if (v != null) onSolarYearChange(Number(v));
                }}
                disabled={loading || !selectedSolarSystemId}
              >
                <SelectTrigger id="solar-year-pick" className="h-10 w-full max-w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {sitesLoading ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading sites…
        </div>
      ) : null}

      {!sitesLoading && solarSites.length > 0 && !selectedSolarSystemId ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <MapPin className="size-8 text-muted-foreground/60" />
            <p className="text-sm font-medium text-foreground">
              Select a solar site
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Pick a site above to load monthly logging and show the table.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {!sitesLoading && solarSites.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <MapPin className="size-8 text-muted-foreground/60" />
            <p className="text-sm font-medium text-foreground">
              No solar sites in scope
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Register sites under Solar systems, then return here.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {loading && !yearData && selectedSolarSystemId ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </div>
      ) : null}

      {yearData && selectedSolarSystemId ? (
        <>
          <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-mono font-medium text-foreground">
                {yearData.unique_identifier}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                {selectedSite?.settlement
                  ? `${selectedSite.village}, ${selectedSite.settlement}`
                  : yearData.village}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{yearData.year}</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="border-border shadow-none">
              <CardHeader className="pb-1 pt-4">
                <CardDescription className="text-xs font-normal text-muted-foreground">
                  Months with a saved log
                </CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums">
                  {counts.logged}
                  <span className="text-base font-normal text-muted-foreground">
                    {" "}
                    / 12
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4 text-xs text-muted-foreground">
                Complete for the selected year
              </CardContent>
            </Card>
            <Card className="border-border shadow-none">
              <CardHeader className="pb-1 pt-4">
                <CardDescription className="text-xs font-normal text-muted-foreground">
                  Months missing
                </CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums text-destructive">
                  {counts.missing}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4 text-xs text-muted-foreground">
                No monthly entry on file
              </CardContent>
            </Card>
          </div>

          <Card className="border-border shadow-none">
            <CardHeader className="border-b border-border/80 pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <CardTitle className="text-base font-medium">
                    Monthly status — {yearData.year}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    <button
                      type="button"
                      className="text-foreground underline-offset-4 hover:underline"
                      onClick={() => navigate(tehsilRoutes.solarMonthlyLogging)}
                    >
                      Monthly logging
                    </button>{" "}
                    to add or edit entries. Export matches the table (month and
                    status).
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-2"
                  onClick={() => downloadSolarComplianceExcel(yearData)}
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
                    <TableHead className="min-w-[160px] pl-6">Month</TableHead>
                    <TableHead className="min-w-[120px]">Status</TableHead>
                    <TableHead className="min-w-[140px] pr-6">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {yearData.months.map((row) => {
                    const name = MONTH_NAMES[row.month] ?? `Month ${row.month}`;
                    const isLogged = row.monthly_status === "logged";
                    return (
                      <TableRow key={row.month}>
                        <TableCell className="pl-6 font-medium">{name}</TableCell>
                        <TableCell>
                          {isLogged ? (
                            <Badge variant="secondary" className="font-normal">
                              Logged
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="font-normal text-muted-foreground">
                              Missing
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="pr-6">
                          {row.monthly_log?.record_id ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8"
                              onClick={() =>
                                navigate(
                                  tehsilRoutes.solarMonthlyLogEdit(
                                    row.monthly_log!.record_id,
                                  ),
                                )
                              }
                            >
                              Open
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-8"
                              onClick={() =>
                                navigate(tehsilRoutes.solarMonthlyLogging)
                              }
                            >
                              Add log
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
