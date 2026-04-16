import { Loader2 } from "lucide-react";
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
import {
  NativeSelect,
  NativeSelectOption,
} from "../../../components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { tehsilRoutes } from "../../../constants/routes";
import { MONTH_NAMES, type CompliancePayload } from "./loggingComplianceTypes";

type SolarLoggingComplianceSectionProps = {
  baseId: string;
  panelId: string;
  solarYear: number;
  setSolarYear: (next: number) => void;
  solarMonth: number;
  setSolarMonth: (next: number) => void;
  yearOptions: number[];
  loading: boolean;
  data: CompliancePayload | null;
  solarStats: { logged: number; missing: number; total: number };
  onReload: () => void;
};

export default function SolarLoggingComplianceSection({
  baseId,
  panelId,
  solarYear,
  setSolarYear,
  solarMonth,
  setSolarMonth,
  yearOptions,
  loading,
  data,
  solarStats,
  onReload,
}: SolarLoggingComplianceSectionProps) {
  const navigate = useNavigate();

  return (
    <div
      id={panelId}
      role="tabpanel"
      aria-labelledby={`${baseId}-tab-solar`}
      className="w-full space-y-6"
    >
      <p className="text-sm font-medium text-foreground">
        2. Set the month and load the list
      </p>

      <Card className="w-full border-secondary/25 ring-1 ring-secondary/15">
        <CardHeader>
          <CardTitle className="text-xl">Solar monthly grid log</CardTitle>
          <CardDescription className="text-base leading-relaxed">
            Choose <strong>year</strong> and <strong>month</strong>. The table
            shows each solar site and whether you have saved that month&apos;s
            electricity figures.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="solar-y" className="text-base">
              Year
            </Label>
            <NativeSelect
              id="solar-y"
              className="min-w-[120px]"
              value={String(solarYear)}
              onChange={(e) => setSolarYear(Number(e.target.value))}
            >
              {yearOptions.map((y) => (
                <NativeSelectOption key={y} value={String(y)}>
                  {y}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="solar-m" className="text-base">
              Month
            </Label>
            <NativeSelect
              id="solar-m"
              className="min-w-[200px]"
              value={String(solarMonth)}
              onChange={(e) => setSolarMonth(Number(e.target.value))}
            >
              {MONTH_NAMES.slice(1).map((name, i) => (
                <NativeSelectOption key={name} value={String(i + 1)}>
                  {name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <Button
            type="button"
            size="lg"
            className="h-11 gap-2"
            onClick={onReload}
            disabled={loading}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            Show solar sites for this month
          </Button>
        </CardContent>
      </Card>

      {loading && !data ? (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-4 py-6 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          <span>Loading solar sites…</span>
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid w-full gap-4 sm:max-w-lg">
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardDescription className="font-medium text-muted-foreground">
                  {MONTH_NAMES[data.solar_month]} {data.solar_year} — progress
                </CardDescription>
                <CardTitle className="text-3xl tabular-nums text-foreground">
                  {solarStats.logged} of {solarStats.total}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Sites where this month&apos;s log is{" "}
                <strong className="text-foreground">already saved</strong>.
                {solarStats.missing > 0 ? (
                  <>
                    {" "}
                    <strong className="text-destructive">
                      {solarStats.missing}
                    </strong>{" "}
                    {solarStats.missing === 1
                      ? "site still needs"
                      : "sites still need"}{" "}
                    a log for this month.
                  </>
                ) : (
                  <> All sites are covered for this month.</>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="w-full overflow-hidden">
            <CardHeader>
              <CardTitle className="text-xl">
                All solar sites — monthly log for the period you picked
              </CardTitle>
              <CardDescription>
                Open the monthly logging screen to add missing months:{" "}
                <button
                  type="button"
                  className="font-semibold text-primary underline underline-offset-2"
                  onClick={() => navigate(tehsilRoutes.solarMonthlyLogging)}
                >
                  Solar monthly logging
                </button>
                .
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0 sm:p-6">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="min-w-[140px]">System ID</TableHead>
                    <TableHead>Village</TableHead>
                    <TableHead>Tehsil</TableHead>
                    <TableHead className="min-w-[120px]">
                      Log for this month?
                    </TableHead>
                    <TableHead className="w-[140px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.solar_systems.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No solar sites are registered for your tehsil in the
                        system.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.solar_systems.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-sm font-medium">
                          {row.unique_identifier}
                        </TableCell>
                        <TableCell>{row.village}</TableCell>
                        <TableCell>{row.tehsil}</TableCell>
                        <TableCell>
                          {row.monthly_status === "logged" ? (
                            <Badge variant="secondary">Yes — saved</Badge>
                          ) : (
                            <Badge variant="destructive">No — missing</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {row.monthly_log?.record_id ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-9"
                              onClick={() =>
                                navigate(
                                  tehsilRoutes.solarMonthlyLogEdit(
                                    row.monthly_log!.record_id,
                                  ),
                                )
                              }
                            >
                              View / edit
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              className="h-9"
                              onClick={() =>
                                navigate(tehsilRoutes.solarMonthlyLogging)
                              }
                            >
                              Add monthly log
                            </Button>
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
