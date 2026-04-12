import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarClock,
  Droplets,
  Info,
  Loader2,
  RefreshCcw,
  Sun,
} from "lucide-react";
import { toast } from "sonner";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../../components/ui/alert";
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
import { cn } from "../../../lib/utils";
import { getApiErrorMessage } from "../../../lib/api-error";
import { getLoggingCompliance } from "../../../services/tehsilManagerOperatorService";

type AssignedOperator = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
};

type WaterSystemRow = {
  id: string;
  tehsil: string;
  village: string;
  settlement?: string | null;
  unique_identifier: string;
  /** Tubewell operators linked via onboarding (user_water_systems). */
  assigned_operators?: AssignedOperator[];
  daily_status: string;
  daily_log: { record_id: string; status: string } | null;
};

type SolarSystemRow = {
  id: string;
  tehsil: string;
  village: string;
  settlement?: string | null;
  unique_identifier: string;
  monthly_status: string;
  monthly_log: { record_id: string; has_data: boolean } | null;
};

type CompliancePayload = {
  water_date: string;
  solar_year: number;
  solar_month: number;
  water_systems: WaterSystemRow[];
  solar_systems: SolarSystemRow[];
};

const MONTH_NAMES = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Short labels for badges (plain English). */
function waterStatusLabel(status: string): string {
  switch (status) {
    case "missing":
      return "Not entered";
    case "draft":
      return "Draft — not sent";
    case "submitted":
      return "Waiting for your review";
    case "accepted":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "reverted_back":
      return "Sent back to operator";
    default:
      return status;
  }
}

function waterStatusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "missing":
      return "destructive";
    case "draft":
      return "secondary";
    case "submitted":
      return "default";
    case "accepted":
      return "outline";
    case "rejected":
      return "destructive";
    case "reverted_back":
      return "secondary";
    default:
      return "outline";
  }
}

function formatAssignedOperators(ops: AssignedOperator[] | undefined): string {
  if (!ops?.length) return "";
  return ops
    .map((o) => o.name?.trim() || o.email)
    .filter(Boolean)
    .join(", ");
}

/** One line per operator for native tooltip (name, email, phone when present). */
function formatAssignedOperatorsTitle(
  ops: AssignedOperator[] | undefined,
): string | undefined {
  if (!ops?.length) return undefined;
  const lines = ops.map((o) => {
    const name = o.name?.trim() || o.email;
    const rest = [o.email && o.email !== name ? o.email : null, o.phone]
      .filter(Boolean)
      .join(" · ");
    return rest ? `${name} (${rest})` : name;
  });
  return lines.join("\n");
}

function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type SectionTab = "water" | "solar";

export default function LoggingCompliance() {
  const navigate = useNavigate();
  const baseId = useId();
  const waterPanelId = `${baseId}-water-panel`;
  const solarPanelId = `${baseId}-solar-panel`;

  const [section, setSection] = useState<SectionTab>("water");
  const [waterDate, setWaterDate] = useState(todayIsoDate);
  const [solarYear, setSolarYear] = useState(new Date().getFullYear());
  const [solarMonth, setSolarMonth] = useState(new Date().getMonth() + 1);
  const [data, setData] = useState<CompliancePayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const raw = await getLoggingCompliance({
        water_date: waterDate,
        solar_year: solarYear,
        solar_month: solarMonth,
      });
      setData(raw as CompliancePayload);
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Failed to load logging compliance"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [waterDate, solarYear, solarMonth]);

  useEffect(() => {
    void load();
  }, [load]);

  const waterStats = useMemo(() => {
    const rows = data?.water_systems ?? [];
    const counts: Record<string, number> = {};
    for (const r of rows) {
      const k = r.daily_status;
      counts[k] = (counts[k] ?? 0) + 1;
    }
    return counts;
  }, [data?.water_systems]);

  const solarStats = useMemo(() => {
    const rows = data?.solar_systems ?? [];
    let logged = 0;
    let missing = 0;
    for (const r of rows) {
      if (r.monthly_status === "logged") logged += 1;
      else missing += 1;
    }
    return { logged, missing, total: rows.length };
  }, [data?.solar_systems]);

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 8 }, (_, i) => y - 4 + i);
  }, []);

  return (
    <div className="w-full max-w-7xl space-y-6 px-4 py-6 md:px-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
            <CalendarClock className="size-7 text-primary" />
          </div>
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Who has logged — who is missing?
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              This screen helps you see, at a glance, whether{" "}
              <strong>tubewell operators</strong> have sent their{" "}
              <strong>daily water</strong> readings and whether{" "}
              <strong>you</strong> have entered <strong>monthly solar</strong>{" "}
              electricity figures for each site. Pick a section below, choose
              the date or month, then press <strong>Load / refresh</strong>.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="default"
          size="default"
          className="shrink-0 gap-2 self-start"
          disabled={loading}
          onClick={() => void load()}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCcw className="size-4" />
          )}
          Load / refresh data
        </Button>
      </div>

      <Alert variant="info">
        {/* <AlertTitle className="text-base">How to read this page</AlertTitle> */}
        <AlertDescription className="text-sm leading-relaxed">
          <ul className="mt-2 list-inside list-disc space-y-1.5">
            <li>
              <strong>Tubewell (water):</strong> Operators must submit one log{" "}
              <em>per site per calendar day</em>. You pick the day and see who
              has not entered anything, who saved a draft, and who is waiting
              for you in{" "}
              <button
                type="button"
                className="font-semibold underline underline-offset-2"
                onClick={() => navigate(tehsilRoutes.waterSubmissions)}
              >
                Submissions
              </button>
              .
            </li>
            <li>
              <strong>Solar sites:</strong> Logging is{" "}
              <em>once per month per site</em> (you enter import/export from the
              grid). Pick year and month to see which sites still need that
              month&apos;s entry.
            </li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* Big, obvious section switch — full width */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">
          1. Choose what you want to check
        </p>
        <div
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          role="tablist"
          aria-label="Water or solar logging"
        >
          <button
            type="button"
            role="tab"
            aria-selected={section === "water"}
            aria-controls={waterPanelId}
            id={`${baseId}-tab-water`}
            className={cn(
              "flex w-full flex-col items-start gap-1 rounded-2xl border-2 px-4 py-4 text-left transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              section === "water"
                ? "border-primary bg-accent shadow-sm ring-1 ring-primary/15"
                : "border-border bg-card hover:border-primary/25 hover:bg-muted/40",
            )}
            onClick={() => setSection("water")}
          >
            <span className="flex items-center gap-2 text-lg font-bold text-foreground">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Droplets className="size-5" />
              </span>
              Tubewell water (daily)
            </span>
            <span className="pl-12 text-sm text-muted-foreground">
              Did each operator send today&apos;s reading for each water system?
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={section === "solar"}
            aria-controls={solarPanelId}
            id={`${baseId}-tab-solar`}
            className={cn(
              "flex w-full flex-col items-start gap-1 rounded-2xl border-2 px-4 py-4 text-left transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              section === "solar"
                ? "border-secondary bg-secondary/10 shadow-sm ring-1 ring-secondary/20"
                : "border-border bg-card hover:border-secondary/35 hover:bg-muted/40",
            )}
            onClick={() => setSection("solar")}
          >
            <span className="flex items-center gap-2 text-lg font-bold text-foreground">
              <span className="flex size-10 items-center justify-center rounded-xl bg-secondary/20 text-secondary">
                <Sun className="size-5" />
              </span>
              Solar power (monthly)
            </span>
            <span className="pl-12 text-sm text-muted-foreground">
              Have you entered this month&apos;s grid import/export for each
              solar site?
            </span>
          </button>
        </div>
      </div>

      {/* Water panel */}
      {section === "water" ? (
        <div
          id={waterPanelId}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-water`}
          className="w-full space-y-6"
        >
          <p className="text-sm font-medium text-foreground">
            2. Set the day and load the list
          </p>

          <Card className="w-full border-primary/20 ring-1 ring-primary/10">
            <CardHeader>
              <CardTitle className="text-xl">
                Tubewell daily water log
              </CardTitle>
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
                onClick={() => void load()}
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
                    Sites with <strong className="text-foreground">no</strong>{" "}
                    log entered for this day
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
                    <strong className="text-foreground">not</strong> send to you
                    yet
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
                        <TableHead className="min-w-[140px]">
                          System ID
                        </TableHead>
                        <TableHead>Village</TableHead>
                        <TableHead>Tehsil</TableHead>

                        <TableHead className="min-w-[180px]">
                          Status for this day
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
                            No water systems are registered for your tehsil in
                            the system.
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.water_systems.map((row) => {
                          const operatorNames = formatAssignedOperators(
                            row.assigned_operators,
                          );
                          const operatorTitle = formatAssignedOperatorsTitle(
                            row.assigned_operators,
                          );
                          return (
                            <TableRow key={row.id}>
                              <TableCell className="font-mono text-sm font-medium">
                                {row.unique_identifier}
                              </TableCell>
                              <TableCell>{row.village}</TableCell>
                              <TableCell>{row.tehsil}</TableCell>
                              {/* <TableCell
                                className="max-w-[220px] text-sm"
                                title={operatorTitle}
                              >
                                {operatorNames ? (
                                  <span className="text-foreground">
                                    {operatorNames}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">
                                    Not assigned
                                  </span>
                                )}
                              </TableCell> */}
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
      ) : null}

      {/* Solar panel */}
      {section === "solar" ? (
        <div
          id={solarPanelId}
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
                Choose <strong>year</strong> and <strong>month</strong>. The
                table shows each solar site and whether you have saved that
                month&apos;s electricity figures.
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
                onClick={() => void load()}
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
                      {MONTH_NAMES[data.solar_month]} {data.solar_year} —
                      progress
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
                        <TableHead className="min-w-[140px]">
                          System ID
                        </TableHead>
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
                                <Badge variant="destructive">
                                  No — missing
                                </Badge>
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
      ) : null}
    </div>
  );
}
