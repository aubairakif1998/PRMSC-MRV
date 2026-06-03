import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  RefreshCcw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { Badge } from "../../../components/ui/badge";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../../components/ui/alert";
import { tehsilRoutes } from "../../../constants/routes";
import { getApiErrorMessage } from "../../../lib/api-error";
import { getActiveWaterSystemCalibrationCertificates } from "../../../services/tehsilManagerOperatorService";
import {
  formatPakistanDate,
  getPakistanIsoDateString,
  pakistanCalendarDayDiff,
} from "../../../utils/pakistanTime";

type ActiveCertRow = {
  water_system: {
    id: string;
    unique_identifier?: string;
    tehsil?: string;
    village?: string;
    settlement?: string;
  };
  certificate: {
    id: string;
    file_url: string;
    uploaded_at?: string | null;
    expiry_date?: string | null;
  };
};

const fileNameFromUrl = (url: string) => {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).at(-1) ?? url;
    return decodeURIComponent(last);
  } catch {
    const last = url.split("/").filter(Boolean).at(-1) ?? url;
    return last;
  }
};

const fmtDate = formatPakistanDate;

type ExpiryState = "expired" | "expiring_7d" | "valid" | "unknown";

const getExpiryMeta = (
  value?: string | null,
): {
  state: ExpiryState;
  daysRemaining: number | null;
} => {
  if (!value) return { state: "unknown", daysRemaining: null };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()))
    return { state: "unknown", daysRemaining: null };

  const expiryIso =
    /^\d{4}-\d{2}-\d{2}/.test(value.trim())
      ? value.trim().slice(0, 10)
      : getPakistanIsoDateString(parsed);
  const daysRemaining = pakistanCalendarDayDiff(expiryIso);

  if (daysRemaining < 0) return { state: "expired", daysRemaining };
  if (daysRemaining <= 7) return { state: "expiring_7d", daysRemaining };
  return { state: "valid", daysRemaining };
};

export default function CalibrationCertificates() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ActiveCertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (soft = false) => {
    try {
      if (soft) setRefreshing(true);
      else setLoading(true);
      const res =
        (await getActiveWaterSystemCalibrationCertificates()) as ActiveCertRow[];
      setRows(Array.isArray(res) ? res : []);
    } catch (e: unknown) {
      toast.error(
        getApiErrorMessage(e, "Could not load calibration certificates"),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();

    const timer = window.setInterval(() => {
      void load(true);
    }, 60_000);

    const onFocus = () => {
      if (document.visibilityState === "hidden") return;
      void load(true);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  const rowsWithExpiry = useMemo(() => {
    const priority = (s: ExpiryState) => {
      if (s === "expired") return 0;
      if (s === "expiring_7d") return 1;
      if (s === "unknown") return 2;
      return 3;
    };

    return rows
      .map((r) => ({
        row: r,
        expiry: getExpiryMeta(r.certificate.expiry_date),
      }))
      .sort((a, b) => {
        const prioDiff = priority(a.expiry.state) - priority(b.expiry.state);
        if (prioDiff !== 0) return prioDiff;

        const aDate = a.row.certificate.expiry_date
          ? new Date(a.row.certificate.expiry_date).getTime()
          : Number.POSITIVE_INFINITY;
        const bDate = b.row.certificate.expiry_date
          ? new Date(b.row.certificate.expiry_date).getTime()
          : Number.POSITIVE_INFINITY;
        return aDate - bDate;
      });
  }, [rows]);

  const expiredCount = useMemo(
    () => rowsWithExpiry.filter((r) => r.expiry.state === "expired").length,
    [rowsWithExpiry],
  );
  const expiringWeekCount = useMemo(
    () => rowsWithExpiry.filter((r) => r.expiry.state === "expiring_7d").length,
    [rowsWithExpiry],
  );
  const validCount = useMemo(
    () => rowsWithExpiry.filter((r) => r.expiry.state === "valid").length,
    [rowsWithExpiry],
  );
  const hasUrgent = expiredCount > 0 || expiringWeekCount > 0;

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Calibration certificates
            </h1>
            <p className="text-sm text-muted-foreground">
              Active bulk-meter calibration certificate per water system in your
              scope. Systems without a bulk meter do not require a calibration
              certificate.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {expiredCount > 0 ? (
              <Badge variant="destructive">{expiredCount} expired</Badge>
            ) : null}
            {expiringWeekCount > 0 ? (
              <Badge className="border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-50">
                {expiringWeekCount} expiring in 7 days
              </Badge>
            ) : null}
            <Button
              variant="outline"
              onClick={() => void load(true)}
              disabled={refreshing}
              className="gap-2"
            >
              <RefreshCcw
                className={`size-4 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </div>

        {hasUrgent ? (
          <Alert
            className={
              expiredCount > 0
                ? "border-red-300 bg-red-50/80 text-red-950"
                : "border-amber-300 bg-amber-50/80 text-amber-950"
            }
          >
            <AlertTriangle className="size-4" />

            <AlertDescription>
              {expiredCount > 0
                ? `${expiredCount} certificate(s) already expired.`
                : ""}
              {expiredCount > 0 && expiringWeekCount > 0 ? " " : ""}
              {expiringWeekCount > 0
                ? `${expiringWeekCount} certificate(s) will expire within the next 7 days.`
                : ""}{" "}
              Please coordinate renewal promptly to avoid compliance gaps.
            </AlertDescription>
          </Alert>
        ) : null}

        {!loading ? (
          <Card className="border-slate-200 bg-white/90">
            <CardContent className="pt-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-red-200 bg-red-50/70 px-3 py-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-red-700">
                    Expired
                  </p>
                  <p className="mt-1 text-xl font-semibold text-red-900">
                    {expiredCount}
                  </p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-amber-700">
                    Due in 7 days
                  </p>
                  <p className="mt-1 text-xl font-semibold text-amber-900">
                    {expiringWeekCount}
                  </p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">
                    Valid
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-xl font-semibold text-emerald-900">
                    <CheckCircle2 className="size-4" />
                    {validCount}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Counts update automatically every minute and when you return to
                this tab.
              </p>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Active certificates</CardTitle>
            <CardDescription>
              {loading
                ? ""
                : `${rows.length} water system(s) with active bulk-meter certificate`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tehsil</TableHead>
                      <TableHead>Village</TableHead>
                      <TableHead>UID</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="h-24 text-center text-muted-foreground"
                        >
                          No active bulk-meter certificates found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rowsWithExpiry.map(({ row: r, expiry }) => (
                        <TableRow
                          key={r.certificate.id}
                          className={
                            expiry.state === "expired"
                              ? "bg-red-50/60"
                              : expiry.state === "expiring_7d"
                                ? "bg-amber-50/60"
                                : ""
                          }
                        >
                          <TableCell className="font-medium">
                            {r.water_system.tehsil || "—"}
                          </TableCell>
                          <TableCell>{r.water_system.village || "—"}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {r.water_system.unique_identifier || "—"}
                          </TableCell>
                          <TableCell>
                            {fmtDate(r.certificate.uploaded_at)}
                          </TableCell>
                          <TableCell>
                            {fmtDate(r.certificate.expiry_date)}
                          </TableCell>
                          <TableCell>
                            {expiry.state === "expired" ? (
                              <Badge variant="destructive">Expired</Badge>
                            ) : expiry.state === "expiring_7d" ? (
                              <Badge className="border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-50">
                                {expiry.daysRemaining === 0
                                  ? "Expires today"
                                  : `Expires in ${expiry.daysRemaining} day(s)`}
                              </Badge>
                            ) : expiry.state === "valid" ? (
                              <Badge variant="secondary">Valid</Badge>
                            ) : (
                              <Badge variant="outline">No expiry date</Badge>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[280px] truncate">
                            {fileNameFromUrl(r.certificate.file_url)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  window.open(r.certificate.file_url, "_blank")
                                }
                              >
                                <FileText className="size-4" />
                                View
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => {
                                  const key =
                                    r.water_system.unique_identifier ||
                                    r.water_system.id;
                                  navigate(
                                    `${tehsilRoutes.waterFormEdit(key)}#calibration-certificates-section`,
                                  );
                                }}
                              >
                                Update certificate
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
