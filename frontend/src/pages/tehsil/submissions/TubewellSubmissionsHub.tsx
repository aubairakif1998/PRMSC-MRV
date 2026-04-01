import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronRight,
  FileCheck,
  Filter,
  RefreshCcw,
  Search,
  Undo2,
  XCircle,
} from "lucide-react";

import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../../../components/ui/empty";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { Skeleton } from "../../../components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { tehsilRoutes } from "../../../constants/routes";
import { useAuth } from "../../../contexts/AuthContext";
import { useTehsilManagerOperatorApi } from "../../../hooks";
import { getApiErrorMessage } from "../../../lib/api-error";

type TubewellSubmissionRow = {
  id: string;
  submission_type: "water_system" | string;
  status: "submitted" | "accepted" | "rejected" | "reverted_back" | string;
  operator_name?: string;
  operator_email?: string;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by_name?: string | null;
  remarks?: string | null;
  system_info?: {
    id?: string;
    uid?: string;
    village?: string;
    tehsil?: string;
    year?: number;
    month?: number;
    last_edited_at?: string | null;
    pump_start_time?: string | null;
    pump_end_time?: string | null;
    pump_operating_hours?: number | null;
    total_water_pumped?: number | null;
    bulk_meter_image_url?: string | null;
  };
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadge(status: TubewellSubmissionRow["status"]) {
  switch (status) {
    case "submitted":
      return (
        <Badge variant="outline" className="gap-1">
          <FileCheck className="size-3.5" />
          Pending review
        </Badge>
      );
    case "accepted":
      return (
        <Badge variant="secondary" className="gap-1">
          <CheckCircle2 className="size-3.5" />
          Accepted
        </Badge>
      );
    case "rejected":
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="size-3.5" />
          Rejected
        </Badge>
      );
    case "reverted_back":
      return (
        <Badge variant="outline" className="gap-1">
          <Undo2 className="size-3.5" />
          Reverted back
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="gap-1">
          {status}
        </Badge>
      );
  }
}

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 8 }, (_, i) => currentYear - 5 + i);
const MONTH_OPTIONS = [
  { v: "", label: "All months" },
  { v: "1", label: "Jan" },
  { v: "2", label: "Feb" },
  { v: "3", label: "Mar" },
  { v: "4", label: "Apr" },
  { v: "5", label: "May" },
  { v: "6", label: "Jun" },
  { v: "7", label: "Jul" },
  { v: "8", label: "Aug" },
  { v: "9", label: "Sep" },
  { v: "10", label: "Oct" },
  { v: "11", label: "Nov" },
  { v: "12", label: "Dec" },
];

export default function TubewellSubmissionsHub() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { getWaterVerificationQueue, getWaterSystems } = useTehsilManagerOperatorApi();

  const [rows, setRows] = useState<TubewellSubmissionRow[]>([]);
  const [waterSystems, setWaterSystems] = useState<
    Array<{
      id: string;
      tehsil?: string;
      village?: string;
      unique_identifier?: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const [status, setStatus] = useState("submitted");
  const [tehsil, setTehsil] = useState("all");
  const [waterSystemId, setWaterSystemId] = useState("all");
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState("");

  const userTehsils = useMemo(
    () => (user?.tehsils ?? []).map((t) => String(t).trim()).filter(Boolean),
    [user?.tehsils],
  );

  // Auto-select signed-in user's tehsil (if available).
  useEffect(() => {
    if (tehsil !== "all") return;
    if (userTehsils.length === 0) return;
    setTehsil(userTehsils[0]!);
  }, [tehsil, userTehsils]);

  const load = async (soft = false) => {
    try {
      if (soft) setRefreshing(true);
      else setLoading(true);
      const data = (await getWaterVerificationQueue()) as {
        submissions?: TubewellSubmissionRow[];
      };
      const list = Array.isArray(data?.submissions) ? data.submissions : [];
      setRows(list);
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Could not load tubewell submissions"));
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadWaterSystems = async () => {
    try {
      const data = (await getWaterSystems()) as any;
      const list = Array.isArray(data) ? data : [];
      setWaterSystems(list);
    } catch (e: unknown) {
      // Non-blocking: submissions can still load.
      setWaterSystems([]);
    }
  };

  useEffect(() => {
    void load();
    void loadWaterSystems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tehsilOptions = useMemo(() => {
    const fromRows = rows
      .map((r) => (r.system_info?.tehsil ?? "").trim())
      .filter(Boolean);
    const base = userTehsils.length > 0 ? userTehsils : fromRows;
    const unique = [...new Set(base)].sort((a, b) => a.localeCompare(b));
    return ["all", ...unique];
  }, [rows, userTehsils]);

  const waterSystemOptions = useMemo(() => {
    const map = new Map<
      string,
      { id: string; uid: string; village?: string | undefined; tehsil?: string | undefined }
    >();

    // Primary source: registered/assigned water systems API.
    for (const s of waterSystems) {
      const id = String((s as any).id ?? "").trim();
      const uid = String((s as any).unique_identifier ?? "").trim();
      const t = String((s as any).tehsil ?? "").trim();
      const v = String((s as any).village ?? "").trim();
      if (!id || !uid) continue;
      if (tehsil !== "all" && t.toUpperCase() !== tehsil.toUpperCase()) continue;
      map.set(id, { id, uid, tehsil: t || undefined, village: v || undefined });
    }

    // Fallback: systems inferred from submissions payload (in case API returns partial list).
    for (const r of rows) {
      if (r.submission_type !== "water_system") continue;
      const sysId = String(r.system_info?.id ?? "").trim();
      const uid = String(r.system_info?.uid ?? "").trim();
      const t = String(r.system_info?.tehsil ?? "").trim();
      if (!sysId || !uid) continue;
      if (tehsil !== "all" && t.toUpperCase() !== tehsil.toUpperCase()) continue;
      if (!map.has(sysId)) {
        map.set(sysId, {
          id: sysId,
          uid,
          village: (r.system_info?.village ?? "").trim() || undefined,
          tehsil: t || undefined,
        });
      }
    }

    return [{ id: "all", label: "All water systems" }].concat(
      Array.from(map.values())
        .sort((a, b) => a.uid.localeCompare(b.uid))
        .map((s) => ({
          id: s.id,
          label: `${s.uid}${s.village ? ` — ${s.village}` : ""}`,
        })),
    );
  }, [rows, tehsil, waterSystems]);

  useEffect(() => {
    // Water systems list depends on tehsil; reset water system when tehsil changes.
    if (waterSystemId !== "all") {
      const ok = waterSystemOptions.some((o) => o.id === waterSystemId);
      if (!ok) setWaterSystemId("all");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tehsil, waterSystemOptions.map((o) => o.id).join("|")]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => r.submission_type === "water_system")
      .filter((r) => (status === "all" ? true : r.status === status))
      .filter((r) => {
        const t = (r.system_info?.tehsil ?? "").trim();
        if (tehsil === "all") return true;
        return t.toUpperCase() === tehsil.toUpperCase();
      })
      .filter((r) => {
        const sid = (r.system_info?.id ?? "").trim();
        if (waterSystemId === "all") return true;
        return sid === waterSystemId;
      })
      .filter((r) => {
        const y = r.system_info?.year;
        if (!year) return true;
        return y === Number(year);
      })
      .filter((r) => {
        const m = r.system_info?.month;
        if (!month) return true;
        return m === Number(month);
      })
      .filter((r) => {
        if (!q) return true;
        const blob = [
          r.id,
          r.operator_name ?? "",
          r.operator_email ?? "",
          r.status,
          r.reviewed_by_name ?? "",
          r.system_info?.uid ?? "",
          r.system_info?.tehsil ?? "",
          r.system_info?.village ?? "",
          String(r.system_info?.month ?? ""),
          String(r.system_info?.year ?? ""),
        ]
          .join(" ")
          .toLowerCase();
        return blob.includes(q);
      })
      .sort((a, b) => {
        const ad = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
        const bd = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
        return bd - ad;
      });
  }, [rows, search, status, tehsil, waterSystemId, year, month]);

  const stats = useMemo(() => {
    const total = rows.filter(
      (r) => r.submission_type === "water_system",
    ).length;
    const pending = rows.filter(
      (r) => r.submission_type === "water_system" && r.status === "submitted",
    ).length;
    const accepted = rows.filter(
      (r) => r.submission_type === "water_system" && r.status === "accepted",
    ).length;
    const rejected = rows.filter(
      (r) => r.submission_type === "water_system" && r.status === "rejected",
    ).length;
    const reverted = rows.filter(
      (r) =>
        r.submission_type === "water_system" && r.status === "reverted_back",
    ).length;
    return { total, pending, accepted, rejected, reverted };
  }, [rows]);

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-6">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Daily Water Logging Submissions
            </h1>
            <p className="text-sm text-muted-foreground">
              Review daily water logs submitted by tubewell operators in your
              tehsil scope.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              void load(true);
              void loadWaterSystems();
            }}
            disabled={refreshing || loading}
            className="gap-2"
          >
            <RefreshCcw
              className={`size-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <Card className="border-border/80">
            <CardContent className="py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Total
              </p>
              <p className="mt-1 text-2xl font-black">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="border-border/80">
            <CardContent className="py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Pending
              </p>
              <p className="mt-1 text-2xl font-black">{stats.pending}</p>
            </CardContent>
          </Card>
          <Card className="border-border/80">
            <CardContent className="py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Accepted
              </p>
              <p className="mt-1 text-2xl font-black">{stats.accepted}</p>
            </CardContent>
          </Card>
          <Card className="border-border/80">
            <CardContent className="py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Rejected
              </p>
              <p className="mt-1 text-2xl font-black">{stats.rejected}</p>
            </CardContent>
          </Card>
          <Card className="border-border/80">
            <CardContent className="py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Reverted
              </p>
              <p className="mt-1 text-2xl font-black">{stats.reverted}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/80">
          <CardHeader className="border-b border-border/60">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Filter className="size-4" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base">Filters</CardTitle>
                <CardDescription>
                  Your tehsil is selected automatically. Water systems update
                  based on the tehsil filter.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 pt-6 md:grid-cols-5">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v ?? "submitted")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="submitted">Pending review</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="reverted_back">Reverted back</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tehsil</Label>
              <Select
                value={tehsil}
                onValueChange={(v) => setTehsil(v ?? "all")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select tehsil" />
                </SelectTrigger>
                <SelectContent>
                  {tehsilOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t === "all" ? "All tehsils" : t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Water system</Label>
              <Select
                value={waterSystemId}
                onValueChange={(v) => setWaterSystemId(v ?? "all")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select water system" />
                </SelectTrigger>
                <SelectContent>
                  {waterSystemOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Year</Label>
              <Select value={year} onValueChange={(v) => setYear(v ?? year)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {YEAR_OPTIONS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Month</Label>
              <Select value={month} onValueChange={(v) => setMonth(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_OPTIONS.map((m) => (
                    <SelectItem key={m.v || "__all__"} value={m.v}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative md:col-span-5">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by operator email, system UID, tehsil, or status…"
                className="h-11 pl-9"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base">Submissions</CardTitle>
            <CardDescription>
              {loading ? "Loading…" : `${filtered.length} row(s)`}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 10 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-11 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <Empty className="border-border/60">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FileCheck className="size-4" />
                  </EmptyMedia>
                  <EmptyTitle>No matching submissions</EmptyTitle>
                  <EmptyDescription>
                    Try adjusting status, tehsil, or water system filters.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setStatus("submitted");
                      setTehsil(userTehsils[0] ?? "all");
                      setWaterSystemId("all");
                      setYear(String(currentYear));
                      setMonth("");
                      setSearch("");
                    }}
                  >
                    Reset filters
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <div className="rounded-xl border border-border/80 bg-card shadow-sm">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Water system</TableHead>
                        <TableHead>Operator email</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Last edited</TableHead>
                        <TableHead className="text-right">Pump hrs</TableHead>
                        <TableHead className="text-right">
                          Water pumped
                        </TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="sticky right-0 z-20 bg-card text-right shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.15)]">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((r) => {
                        const from = `${location.pathname}${location.search}`;
                        return (
                          <TableRow key={r.id} className="align-top">
                            <TableCell>
                              <div className="min-w-[220px]">
                                <p className="font-medium text-foreground">
                                  {r.system_info?.uid || "—"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {(r.system_info?.village || "—") +
                                    " · " +
                                    (r.system_info?.tehsil || "—") +
                                    " · " +
                                    (r.system_info?.month ?? "—") +
                                    "/" +
                                    (r.system_info?.year ?? "—")}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {r.operator_email || "—"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {formatDateTime(r.submitted_at)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {formatDateTime(
                                r.system_info?.last_edited_at ?? null,
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {r.system_info?.pump_operating_hours ?? "—"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {r.system_info?.total_water_pumped ?? "—"}
                            </TableCell>
                            <TableCell>{statusBadge(r.status)}</TableCell>
                            <TableCell className="sticky right-0 z-10 bg-card text-right shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.12)]">
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                                onClick={() =>
                                  navigate(
                                    tehsilRoutes.waterSubmissionDetails(r.id),
                                    { state: { from } },
                                  )
                                }
                              >
                                Details <ChevronRight className="size-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
