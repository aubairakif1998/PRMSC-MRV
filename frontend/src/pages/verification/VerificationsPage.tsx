import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, Clock, RefreshCcw, Search, SendToBack, XCircle } from "lucide-react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import { Skeleton } from "../../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { useTehsilManagerOperatorApi } from "../../hooks";
import { getApiErrorMessage } from "../../lib/api-error";
import { useAuth } from "../../contexts/AuthContext";
import { isTehsilManager } from "../../constants/roles";
import { tehsilRoutes } from "../../constants/routes";

type QueueRow = {
  id: string;
  submission_type: "water_system" | string;
  status: "submitted" | "accepted" | "rejected" | "reverted_back" | string;
  operator_email?: string;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by_name?: string | null;
  remarks?: string | null;
  system_info?: {
    uid?: string;
    village?: string;
    tehsil?: string;
    year?: number;
    month?: number;
    last_edited_at?: string | null;
    pump_operating_hours?: number | null;
    total_water_pumped?: number | null;
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

function statusBadge(status: QueueRow["status"]) {
  switch (status) {
    case "submitted":
      return (
        <Badge variant="outline" className="gap-1">
          <Clock className="size-3.5" /> Pending
        </Badge>
      );
    case "accepted":
      return (
        <Badge variant="secondary" className="gap-1">
          <CheckCircle2 className="size-3.5" /> Accepted
        </Badge>
      );
    case "rejected":
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="size-3.5" /> Rejected
        </Badge>
      );
    case "reverted_back":
      return (
        <Badge variant="outline" className="gap-1">
          <SendToBack className="size-3.5" /> Reverted
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function VerificationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const tehsilMgr = user ? isTehsilManager(user.role) : false;
  const { getWaterVerificationQueue } = useTehsilManagerOperatorApi();

  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"pending" | "reviewed" | "all">("pending");

  const load = async (soft = false) => {
    try {
      if (soft) setRefreshing(true);
      else setLoading(true);
      const data = (await getWaterVerificationQueue()) as { submissions?: QueueRow[] };
      setRows(Array.isArray(data?.submissions) ? data.submissions : []);
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Could not load verifications"));
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => r.submission_type === "water_system")
      .filter((r) => {
        if (view === "all") return true;
        if (view === "pending") return r.status === "submitted";
        return r.status === "accepted" || r.status === "rejected" || r.status === "reverted_back";
      })
      .filter((r) => {
        if (!q) return true;
        const blob = [
          r.id,
          r.operator_email ?? "",
          r.status,
          r.reviewed_by_name ?? "",
          r.system_info?.uid ?? "",
          r.system_info?.tehsil ?? "",
          r.system_info?.village ?? "",
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
  }, [rows, search, view]);

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Verifications</h1>
            <p className="text-sm text-muted-foreground">
              Monitor pending and reviewed water submissions in your tehsil scope.
            </p>
          </div>
          <Button variant="outline" onClick={() => void load(true)} disabled={loading || refreshing} className="gap-2">
            <RefreshCcw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <Card className="border-border/80">
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base">View</CardTitle>
            <CardDescription>Pending vs reviewed outcomes.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Show</Label>
              <NativeSelect value={view} onChange={(e) => setView(e.target.value as any)} className="w-full">
                <NativeSelectOption value="pending">Pending (submitted)</NativeSelectOption>
                <NativeSelectOption value="reviewed">Reviewed (accepted / rejected / reverted)</NativeSelectOption>
                <NativeSelectOption value="all">All</NativeSelectOption>
              </NativeSelect>
            </div>
            <div className="relative space-y-2">
              <Label>Search</Label>
              <Search className="pointer-events-none absolute left-3 top-[42px] size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                placeholder="Search by water system UID, operator email, tehsil, village, reviewer…"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base">Results</CardTitle>
            <CardDescription>{loading ? "Loading…" : `${filtered.length} row(s)`}</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border/80 bg-card shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Water system</TableHead>
                      <TableHead>Operator email</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Reviewed</TableHead>
                      <TableHead>Reviewed by</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">KPIs</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="min-w-[220px]">
                            <p className="font-medium">{r.system_info?.uid || "—"}</p>
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
                        <TableCell>{r.operator_email || "—"}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDateTime(r.submitted_at)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDateTime(r.reviewed_at ?? null)}
                        </TableCell>
                        <TableCell className="text-sm">{r.reviewed_by_name || "—"}</TableCell>
                        <TableCell>{statusBadge(r.status)}</TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs text-muted-foreground">
                          <span className="tabular-nums">
                            {r.system_info?.pump_operating_hours ?? "—"} hrs
                          </span>
                          {" · "}
                          <span className="tabular-nums">
                            {r.system_info?.total_water_pumped ?? "—"} m³
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (tehsilMgr) navigate(tehsilRoutes.waterSubmissionDetails(r.id));
                              else navigate(`/submissions/review/${r.id}`);
                            }}
                          >
                            Open
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
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
