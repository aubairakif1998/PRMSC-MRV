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
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { tehsilRoutes } from "../../../constants/routes";
import { cn } from "../../../lib/utils";
import {
  type CompliancePayload,
  formatAssignedOperators,
  formatAssignedOperatorsTitle,
  waterStatusLabel,
  waterStatusVariant,
} from "./loggingComplianceTypes";

type WaterLoggingComplianceSectionProps = {
  baseId: string;
  panelId: string;
  waterDate: string;
  setWaterDate: (next: string) => void;
  loading: boolean;
  data: CompliancePayload | null;
  waterStats: Record<string, number>;
  onReload: () => void;
};

export default function WaterLoggingComplianceSection({
  baseId,
  panelId,
  waterDate,
  setWaterDate,
  loading,
  data,
  waterStats,
  onReload,
}: WaterLoggingComplianceSectionProps) {
  const navigate = useNavigate();

  return (
    <div
      id={panelId}
      role="tabpanel"
      aria-labelledby={`${baseId}-tab-water`}
      className="w-full space-y-6"
    >
      <p className="text-sm font-medium text-foreground">
        2. Set the day and load the list
      </p>

      <Card className="w-full border-primary/20 ring-1 ring-primary/10">
        <CardHeader>
          <CardTitle className="text-xl">Tubewell daily water log</CardTitle>
          <CardDescription className="text-base leading-relaxed">
            Select one <strong>calendar date</strong>. The table shows every
            water system in your tehsil and whether a log exists for{" "}
            <em>that exact day</em>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[200px] space-y-2">
            <Label htmlFor="water-date" className="text-base">
              Which day do you want to check?
            </Label>
            <Input
              id="water-date"
              type="date"
              className="h-11 text-base"
              value={waterDate}
              onChange={(e) => setWaterDate(e.target.value)}
            />
          </div>
          <Button
            type="button"
            size="lg"
            className="h-11 gap-2"
            onClick={onReload}
            disabled={loading}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            Show status for this day
          </Button>
        </CardContent>
      </Card>

      {loading && !data ? (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-4 py-6 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          <span>Loading water systems…</span>
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid w-full gap-4 sm:grid-cols-3">
            <Card className="border-l-4 border-l-destructive border-border bg-card">
              <CardHeader className="pb-2">
                <CardDescription className="font-medium text-foreground">
                  Still empty ({data.water_date})
                </CardDescription>
                <CardTitle className="text-3xl tabular-nums text-destructive">
                  {waterStats.missing ?? 0}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Sites with <strong className="text-foreground">no</strong> log
                entered for this day
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-muted-foreground border-border bg-muted/30">
              <CardHeader className="pb-2">
                <CardDescription className="font-medium text-foreground">
                  Draft only
                </CardDescription>
                <CardTitle className="text-3xl tabular-nums text-foreground">
                  {waterStats.draft ?? 0}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Operator started but did{" "}
                <strong className="text-foreground">not</strong> send to you yet
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-primary border-border bg-accent/40">
              <CardHeader className="pb-2">
                <CardDescription className="font-medium text-foreground">
                  With you / done
                </CardDescription>
                <CardTitle className="text-3xl tabular-nums text-primary">
                  {(waterStats.submitted ?? 0) + (waterStats.accepted ?? 0)}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Submitted for review or already approved
              </CardContent>
            </Card>
          </div>

          <Card className="w-full overflow-hidden">
            <CardHeader>
              <CardTitle className="text-xl">
                All water systems — status for the day you picked
              </CardTitle>
              <CardDescription>
                Review pending items in{" "}
                <button
                  type="button"
                  className="font-semibold text-primary underline underline-offset-2"
                  onClick={() => navigate(tehsilRoutes.waterSubmissions)}
                >
                  Submissions
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
                    <TableHead className="min-w-[200px]">
                      Tubewell operator(s)
                    </TableHead>
                    <TableHead className="min-w-[160px]">
                      Status for the day
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.water_systems.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No water systems are registered for your tehsil in the
                        system.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.water_systems.map((row) => {
                      const ops = row.assigned_operators;
                      const opsText = formatAssignedOperators(ops);
                      const opsTitle = formatAssignedOperatorsTitle(ops);
                      const showOps = opsText.trim() !== "";
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="font-mono text-sm font-medium">
                            {row.unique_identifier}
                          </TableCell>
                          <TableCell>{row.village}</TableCell>
                          <TableCell>{row.tehsil}</TableCell>
                          <TableCell
                            className={cn(
                              "max-w-[380px] whitespace-normal",
                              showOps
                                ? "text-foreground"
                                : "text-muted-foreground",
                            )}
                            title={opsTitle}
                          >
                            {showOps ? (
                              <span className="line-clamp-2">{opsText}</span>
                            ) : (
                              <span className="italic">
                                No operator assigned
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={waterStatusVariant(row.daily_status)}
                              className="whitespace-normal text-left"
                            >
                              {waterStatusLabel(row.daily_status)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
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

