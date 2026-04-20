import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileCheck,
  Loader2,
  RotateCcw,
  SendToBack,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Separator } from "../../../components/ui/separator";
import { Skeleton } from "../../../components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { Textarea } from "../../../components/ui/textarea";
import { tehsilRoutes } from "../../../constants/routes";
import { useTehsilManagerOperatorApi } from "../../../hooks";
import { getApiErrorMessage } from "../../../lib/api-error";

type DetailResponse = {
  submission?: {
    id: string;
    submission_type: string;
    status: "submitted" | "accepted" | "rejected" | "reverted_back" | string;
    operator_name?: string;
    operator_email?: string;
    submitted_at?: string | null;
    reviewed_at?: string | null;
    approved_at?: string | null;
    reviewed_by_name?: string | null;
    approved_by_name?: string | null;
    remarks?: string | null;
  };
  record_data?: {
    year?: number | null;
    month?: number | null;
    last_edited_at?: string | null;
    pump_start_time?: string | null;
    pump_end_time?: string | null;
    pump_operating_hours?: number | null;
    total_water_pumped?: number | null;
    bulk_meter_image_url?: string | null;
    signed?: boolean | null;
    signature_svg_snapshot?: string | null;
    system?: {
      id?: string | null;
      unique_identifier?: string | null;
      village?: string | null;
      tehsil?: string | null;
      settlement?: string | null;
      pump_model?: string | null;
      pump_serial_number?: string | null;
      start_of_operation?: string | null;
      depth_of_water_intake?: number | null;
      height_to_ohr?: number | null;
      pump_flow_rate?: number | null;
      meter_model?: string | null;
      meter_serial_number?: string | null;
      meter_accuracy_class?: string | null;
      calibration_requirement?: string | null;
      installation_date?: string | null;
    };
  };
  audit_trail?: Array<{
    action_type: string;
    performed_by: string;
    role: string;
    comment: string;
    created_at?: string | null;
  }>;
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

function kv(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function fmt2(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toFixed(2);
}

function openSvgInNewTab(svg: string) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  // Best-effort cleanup (tab may still be loading).
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function statusBadge(status: string) {
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
          <SendToBack className="size-3.5" />
          Reverted back
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function WaterSubmissionDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const submissionId = String(id ?? "").trim();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    getWaterSubmissionDetailForTehsilManager,
    acceptWaterSubmission,
    rejectWaterSubmission,
    revertWaterSubmission,
  } = useTehsilManagerOperatorApi();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DetailResponse | null>(null);

  const [actionOpen, setActionOpen] = useState<
    null | "accept" | "reject" | "revert"
  >(null);
  const [remarks, setRemarks] = useState("");
  const [acting, setActing] = useState(false);

  const backTo = useMemo(() => {
    const from = (location.state as { from?: string } | null)?.from;
    return typeof from === "string" && from.trim()
      ? from
      : tehsilRoutes.waterSubmissions;
  }, [location.state]);

  const load = async () => {
    if (!submissionId) {
      setError("Missing submission id.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = (await getWaterSubmissionDetailForTehsilManager(
        submissionId,
      )) as DetailResponse;
      setData(res ?? null);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, "Could not load submission details"));
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId]);

  const submission = data?.submission;
  const record = data?.record_data;
  const system = record?.system;
  const audit = Array.isArray(data?.audit_trail) ? data?.audit_trail ?? [] : [];
  const signatureSvg = record?.signature_svg_snapshot?.trim()
    ? record.signature_svg_snapshot
    : null;

  const canAct = submission?.status === "submitted";

  const runAction = async () => {
    if (!submission) return;
    if (!actionOpen) return;

    if (actionOpen === "reject" && !remarks.trim()) {
      toast.error("Rejection reason is required.");
      return;
    }

    setActing(true);
    try {
      if (actionOpen === "accept") {
        await acceptWaterSubmission(submission.id, { remarks: remarks.trim() });
        toast.success("Submission accepted");
      } else if (actionOpen === "reject") {
        await rejectWaterSubmission(submission.id, { remarks: remarks.trim() });
        toast.success("Submission rejected");
      } else if (actionOpen === "revert") {
        await revertWaterSubmission(submission.id, { remarks: remarks.trim() });
        toast.success("Submission reverted to operator");
      }
      setActionOpen(null);
      setRemarks("");
      navigate(backTo, { replace: true });
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Action failed"));
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 p-4 pb-16 md:p-6">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => navigate(backTo)}
            >
              <ArrowLeft className="size-4" />
              Back to submissions
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                Submission details
              </h1>
              {submission?.status ? statusBadge(submission.status) : null}
              {record?.signed ? (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="size-3.5" />
                  Signed
                </Badge>
              ) : (
                <Badge variant="outline">Unsigned</Badge>
              )}
              {submission?.id ? (
                <Badge variant="outline" className="font-mono text-xs">
                  {submission.id.slice(0, 8).toUpperCase()}
                </Badge>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              Review operator-provided daily log details, evidence, and the audit trail.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => void load()}
            disabled={loading}
          >
            <RotateCcw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Reload
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : error ? (
          <Card className="border-rose-200 bg-rose-50/50">
            <CardContent className="py-8 text-sm text-rose-900">{error}</CardContent>
          </Card>
        ) : !submission ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              No data found.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-border/80">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Operator</CardTitle>
                  <CardDescription>Submitted by</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p className="font-semibold">{kv(submission.operator_name)}</p>
                  <p className="text-muted-foreground">{kv(submission.operator_email)}</p>
                </CardContent>
              </Card>

              <Card className="border-border/80">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Location</CardTitle>
                  <CardDescription>Water system</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p className="font-semibold">
                    {kv(system?.village)} · {kv(system?.tehsil)}
                  </p>
                  <p className="text-muted-foreground">
                    UID: {kv(system?.unique_identifier)}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/80">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Timing</CardTitle>
                  <CardDescription>Queue timestamps</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p>
                    <span className="text-muted-foreground">Submitted:</span>{" "}
                    {formatDateTime(submission.submitted_at)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Last edited:</span>{" "}
                    {formatDateTime(record?.last_edited_at)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Reviewed:</span>{" "}
                    {formatDateTime(submission.reviewed_at)}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border/80">
              <CardHeader className="border-b border-border/60">
                <CardTitle className="text-base">Daily log</CardTitle>
                <CardDescription>
                  Period: {kv(record?.month)}/{kv(record?.year)} · Pump hours & water pumped
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 pt-6 md:grid-cols-3">
                <div className="space-y-1 rounded-xl border border-border/70 bg-card p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Pump start
                  </p>
                  <p className="text-base font-semibold">{kv(record?.pump_start_time)}</p>
                </div>
                <div className="space-y-1 rounded-xl border border-border/70 bg-card p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Pump end
                  </p>
                  <p className="text-base font-semibold">{kv(record?.pump_end_time)}</p>
                </div>
                <div className="space-y-1 rounded-xl border border-border/70 bg-card p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Operating hours
                  </p>
                  <p className="text-base font-semibold tabular-nums">
                    {fmt2(record?.pump_operating_hours)}
                  </p>
                </div>
                <div className="space-y-1 rounded-xl border border-border/70 bg-card p-4 md:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Total water pumped
                  </p>
                  <p className="text-base font-semibold tabular-nums">
                    {kv(record?.total_water_pumped)}
                  </p>
                </div>
                <div className="space-y-1 rounded-xl border border-border/70 bg-card p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Evidence
                  </p>
                  {record?.bulk_meter_image_url?.trim() ? (
                    <a
                      href={record.bulk_meter_image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      View image <ExternalLink className="size-4" />
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground">No image</p>
                  )}
                </div>

                <div className="space-y-2 rounded-xl border border-border/70 bg-card p-4 md:col-span-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Operator signature stamp
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {record?.signed ? (
                        <Badge variant="secondary">Signed</Badge>
                      ) : (
                        <Badge variant="outline">Unsigned</Badge>
                      )}
                      {signatureSvg ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1.5 px-2 text-xs"
                          onClick={() => openSvgInNewTab(signatureSvg)}
                        >
                          <ExternalLink className="size-3.5" />
                          Open
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {signatureSvg ? (
                    <div className="rounded-xl border bg-gradient-to-b from-white to-slate-50 p-3">
                      <div
                        className="h-36 w-full overflow-hidden rounded-lg border bg-white p-2 shadow-sm [&_svg]:h-full [&_svg]:w-full [&_svg]:max-w-none"
                        dangerouslySetInnerHTML={{ __html: signatureSvg }}
                      />
                      <p className="mt-2 text-xs text-muted-foreground">
                        This is the signature snapshot stored on the log at submit time.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                      No signature snapshot found for this record.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/80">
              <CardHeader className="border-b border-border/60">
                <CardTitle className="text-base">Audit trail</CardTitle>
                <CardDescription>
                  Every workflow action is logged (submit, accept, reject, revert).
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {audit.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No audit logs.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-border/70">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>When</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>By</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Comment</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {audit.map((l, idx) => (
                          <TableRow key={`${l.action_type}-${idx}`}>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {formatDateTime(l.created_at)}
                            </TableCell>
                            <TableCell className="font-medium">{kv(l.action_type)}</TableCell>
                            <TableCell>{kv(l.performed_by)}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{kv(l.role)}</Badge>
                            </TableCell>
                            <TableCell className="max-w-[520px] text-sm text-muted-foreground">
                              {kv(l.comment)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <Separator className="my-6" />

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm">
                    <p className="font-semibold text-foreground">
                      Review actions
                    </p>
                    <p className="text-muted-foreground">
                      {canAct
                        ? "Choose one: accept, reject (with reason), or revert back to operator."
                        : "This submission is not pending review."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="gap-2"
                      onClick={() => setActionOpen("accept")}
                      disabled={!canAct}
                    >
                      <CheckCircle2 className="size-4" />
                      Accept
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={() => setActionOpen("revert")}
                      disabled={!canAct}
                    >
                      <SendToBack className="size-4" />
                      Revert back
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className="gap-2"
                      onClick={() => setActionOpen("reject")}
                      disabled={!canAct}
                    >
                      <XCircle className="size-4" />
                      Reject
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Dialog
        open={actionOpen !== null}
        onOpenChange={(open) => {
          if (!open && !acting) {
            setActionOpen(null);
            setRemarks("");
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {actionOpen === "accept"
                ? "Accept submission"
                : actionOpen === "reject"
                  ? "Reject submission"
                  : "Revert submission back to operator"}
            </DialogTitle>
            <DialogDescription>
              {actionOpen === "reject"
                ? "Provide a clear rejection reason. The operator will see this message."
                : "Optional remarks help audit and operator correction."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="remarks">
              Remarks {actionOpen === "reject" ? "(required)" : "(optional)"}
            </Label>
            <Textarea
              id="remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder={
                actionOpen === "reject"
                  ? "e.g. Bulk meter image is unclear. Please re-upload."
                  : "Add a short note (optional)…"
              }
              rows={4}
              disabled={acting}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setActionOpen(null)}
              disabled={acting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={actionOpen === "reject" ? "destructive" : "default"}
              onClick={() => void runAction()}
              disabled={acting || (actionOpen === "reject" && !remarks.trim())}
              className="gap-2"
            >
              {acting ? <Loader2 className="size-4 animate-spin" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

