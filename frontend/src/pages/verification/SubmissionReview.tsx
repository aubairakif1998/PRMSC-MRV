import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  ImageIcon,
  MapPin,
  ShieldCheck,
  Sun,
  User,
  XCircle,
} from "lucide-react";
import {
  canApproveSubmissions,
  isTubewellOperator,
} from "../../constants/roles";
import { useAuth } from "../../contexts/AuthContext";
import { useVerificationApi } from "../../hooks";
import { getApiErrorMessage } from "../../lib/api-error";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Separator } from "../../components/ui/separator";
import { Skeleton } from "../../components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Textarea } from "../../components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { toast } from "sonner";
import { getApiOrigin } from "../../utils/apiOrigin";

const STATUS_CONFIG = {
  draft: {
    label: "Draft",
    className: "border-indigo-200 bg-indigo-50 text-indigo-700",
  },
  submitted: {
    label: "Submitted",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  under_review: {
    label: "Under Review",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  verified: {
    label: "Verified",
    className: "border-violet-200 bg-violet-50 text-violet-700",
  },
  rejected: {
    label: "Rejected",
    className: "border-red-200 bg-red-50 text-red-700",
  },
  approved: {
    label: "Approved",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
} as const;

type SubmissionStatus = keyof typeof STATUS_CONFIG;

type SubmissionDetail = {
  id: string;
  status: SubmissionStatus;
  submission_type: "water_system" | "solar_system";
  operator_name?: string;
  operator_email?: string;
  submitted_at?: string;
  reviewed_at?: string;
  approved_at?: string;
  updated_at?: string;
};

type SubmissionSystem = {
  tehsil?: string;
  village?: string;
  settlement?: string;
  pump_model?: string;
  pump_serial_number?: string;
  pump_flow_rate?: number | string;
  depth_of_water_intake?: number | string;
  height_to_ohr?: number | string;
  solar_panel_capacity?: number | string;
  inverter_capacity?: number | string;
  inverter_serial_number?: string;
  meter_model?: string;
  meter_serial_number?: string;
  meter_accuracy_class?: string;
  green_meter_connection_date?: string;
};

type SubmissionRecordData = {
  system?: SubmissionSystem;
  month?: number | string;
  year?: number | string;
  pump_start_time?: string | null;
  pump_end_time?: string | null;
  pump_operating_hours?: number | string;
  total_water_pumped?: number | string;
  export_off_peak?: number | string;
  export_peak?: number | string;
  import_off_peak?: number | string;
  import_peak?: number | string;
  net_off_peak?: number | string;
  net_peak?: number | string;
  bulk_meter_image_url?: string;
  bulk_meter_image_path?: string; // backward compatibility
  electricity_bill_url?: string;
  electricity_bill_image_url?: string; // backward compatibility
  electricity_bill_image?: string; // backward compatibility
};

type AuditLog = {
  action_type: string;
  performed_by?: string;
  performed_by_name?: string;
  timestamp?: string;
  comment?: string;
};

const infoValue = (value: unknown, suffix = "") => {
  if (value === null || value === undefined || value === "") return "-";
  return `${String(value)}${suffix}`;
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getImageUrl = (path?: string) => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const parts = path.split(/[\\/]/);
  const filename = parts[parts.length - 1];
  const origin = getApiOrigin();
  return `${origin}/api/uploads/${encodeURIComponent(filename)}`;
};

const actionColor = (action: string) => {
  const map: Record<string, string> = {
    submit: "bg-amber-500",
    verify: "bg-violet-500",
    reject: "bg-red-500",
    approve: "bg-emerald-500",
    review: "bg-blue-500",
  };
  return map[action] ?? "bg-slate-400";
};

const MetaItem = ({ label, value }: { label: string; value: string }) => (
  <div className="space-y-0.5 rounded-md border bg-muted/20 p-2">
    <p className="text-[11px] text-muted-foreground">{label}</p>
    <p className="text-sm font-medium leading-tight">{value}</p>
  </div>
);

const EvidenceCard = ({ title, url }: { title: string; url: string }) => (
  <Card className="overflow-hidden">
    <CardHeader className="flex-row items-center justify-between space-y-0">
      <CardTitle className="text-sm">{title}</CardTitle>
      <div className="flex items-center gap-2">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => window.open(url, "_blank")}
        >
          <Download className="size-4" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => window.open(url, "_blank")}
        >
          <ExternalLink className="size-4" />
        </Button>
      </div>
    </CardHeader>
    <CardContent>
      <img
        src={url}
        alt={title}
        className="mx-auto max-h-[300px] w-full rounded-md object-contain"
      />
    </CardContent>
  </Card>
);

const SubmissionReview = () => {
  const {
    getSubmissionDetail,
    verifySubmission,
    rejectSubmission,
  } = useVerificationApi();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [recordData, setRecordData] = useState<SubmissionRecordData | null>(
    null,
  );
  const [auditTrail, setAuditTrail] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError("");
        if (!id) {
          navigate(-1);
          return;
        }
        const data = await getSubmissionDetail(id, user?.role);
        setSubmission(
          (data as { submission?: SubmissionDetail }).submission || null,
        );
        setRecordData(
          (data as { record_data?: SubmissionRecordData }).record_data || null,
        );
        setAuditTrail((data as { audit_trail?: AuditLog[] }).audit_trail || []);
      } catch (err) {
        const message = getApiErrorMessage(
          err,
          "Failed to load submission details",
        );
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [id, navigate, user?.role]);

  const isOperator = isTubewellOperator(user?.role);
  const canAct =
    !isOperator &&
    (submission?.status === "submitted" ||
      submission?.status === "under_review");
  const canFinalApprove =
    canApproveSubmissions(user?.role) && submission?.status === "verified";
  const isWaterSystem = submission?.submission_type === "water_system";

  const statusBadge = useMemo(() => {
    const status = submission?.status ?? "draft";
    const config = STATUS_CONFIG[status];
    return (
      <Badge variant="outline" className={config.className}>
        {config.label}
      </Badge>
    );
  }, [submission?.status]);

  const waterEvidenceUrl = getImageUrl(
    recordData?.bulk_meter_image_url || recordData?.bulk_meter_image_path,
  );
  const solarEvidenceUrl = getImageUrl(
    recordData?.electricity_bill_url ||
      recordData?.electricity_bill_image_url ||
      recordData?.electricity_bill_image,
  );

  const verifyAction = async () => {
    if (!id) return;
    try {
      setActionLoading(true);
      setError("");
      await verifySubmission(id, remarks.trim());
      toast.success("Submission verified");
      navigate("/submissions");
    } catch (err) {
      const message = getApiErrorMessage(err, "Failed to verify submission");
      setError(message);
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  };

  const rejectAction = async () => {
    if (!remarks.trim()) {
      const message = "Please provide a reason for rejection.";
      setError(message);
      toast.error(message);
      return;
    }
    if (!id) return;
    try {
      setActionLoading(true);
      setError("");
      await rejectSubmission(id, remarks.trim());
      toast.success("Submission rejected");
      navigate("/submissions");
    } catch (err) {
      const message = getApiErrorMessage(err, "Failed to reject submission");
      setError(message);
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 p-4 md:p-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
          <Skeleton className="h-12 w-80" />
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <Skeleton className="h-44 w-full" />
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-44 w-full" />
              <Skeleton className="h-56 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="min-h-screen bg-muted/30 p-4 md:p-6">
        <Card className="mx-auto max-w-2xl">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Submission was not found or could not be loaded.
            </p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="size-4" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="size-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Submission Review
              </h1>
              <p className="text-sm text-muted-foreground">
                #{submission.id.toUpperCase()} • Last updated{" "}
                {formatDate(submission.updated_at)}
              </p>
            </div>
          </div>
          {statusBadge}
        </div>

        {error ? (
          <Card>
            <CardContent className="pt-6 text-sm text-destructive">
              {error}
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    Location
                  </CardDescription>
                  <CardTitle className="text-base">
                    {infoValue(recordData?.system?.village)},{" "}
                    {infoValue(recordData?.system?.tehsil)}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1">
                    <CalendarDays className="size-3.5" />
                    Period
                  </CardDescription>
                  <CardTitle className="text-base">
                    {infoValue(recordData?.month)} /{" "}
                    {infoValue(recordData?.year)}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1">
                    {isWaterSystem ? (
                      <FileText className="size-3.5" />
                    ) : (
                      <Sun className="size-3.5" />
                    )}
                    Facility Type
                  </CardDescription>
                  <CardTitle className="text-base">
                    {isWaterSystem ? "Water Pumping" : "Solar Power"}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  System & Operational Data
                </CardTitle>
                <CardDescription>
                  Technical details and monthly operating values
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <MetaItem
                  label="Tehsil"
                  value={infoValue(recordData?.system?.tehsil)}
                />
                <MetaItem
                  label="Village"
                  value={infoValue(recordData?.system?.village)}
                />
                <MetaItem
                  label="Settlement"
                  value={infoValue(recordData?.system?.settlement)}
                />
                <MetaItem
                  label={isWaterSystem ? "Pump Model" : "Panel Capacity"}
                  value={
                    isWaterSystem
                      ? infoValue(recordData?.system?.pump_model)
                      : infoValue(
                          recordData?.system?.solar_panel_capacity,
                          " kWp",
                        )
                  }
                />
                {isWaterSystem ? (
                  <>
                    <MetaItem
                      label="Pump start"
                      value={infoValue(recordData?.pump_start_time)}
                    />
                    <MetaItem
                      label="Pump end"
                      value={infoValue(recordData?.pump_end_time)}
                    />
                    <MetaItem
                      label="Operating Hours"
                      value={infoValue(
                        recordData?.pump_operating_hours,
                        " hrs",
                      )}
                    />
                    <MetaItem
                      label="Total Water Pumped"
                      value={infoValue(recordData?.total_water_pumped, " m³")}
                    />
                    <MetaItem
                      label="Pump Serial Number"
                      value={infoValue(recordData?.system?.pump_serial_number)}
                    />
                    <MetaItem
                      label="Pump Flow Rate"
                      value={infoValue(
                        recordData?.system?.pump_flow_rate,
                        " m³/h",
                      )}
                    />
                    <MetaItem
                      label="Water Intake Depth"
                      value={infoValue(
                        recordData?.system?.depth_of_water_intake,
                        " m",
                      )}
                    />
                    <MetaItem
                      label="Height to OHR"
                      value={infoValue(recordData?.system?.height_to_ohr, " m")}
                    />
                  </>
                ) : (
                  <>
                    <MetaItem
                      label="Import off-peak"
                      value={infoValue(recordData?.import_off_peak, " kWh")}
                    />
                    <MetaItem
                      label="Import peak"
                      value={infoValue(recordData?.import_peak, " kWh")}
                    />
                    <MetaItem
                      label="Export off-peak"
                      value={infoValue(recordData?.export_off_peak, " kWh")}
                    />
                    <MetaItem
                      label="Export peak"
                      value={infoValue(recordData?.export_peak, " kWh")}
                    />
                    <MetaItem
                      label="Net off-peak"
                      value={infoValue(recordData?.net_off_peak, " kWh")}
                    />
                    <MetaItem
                      label="Net peak"
                      value={infoValue(recordData?.net_peak, " kWh")}
                    />
                    <MetaItem
                      label="Inverter Capacity"
                      value={infoValue(
                        recordData?.system?.inverter_capacity,
                        " kVA",
                      )}
                    />
                    <MetaItem
                      label="Inverter Serial Number"
                      value={infoValue(
                        recordData?.system?.inverter_serial_number,
                      )}
                    />
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Meter & Compliance</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <MetaItem
                  label="Meter Model"
                  value={infoValue(recordData?.system?.meter_model)}
                />
                <MetaItem
                  label="Meter Serial Number"
                  value={infoValue(recordData?.system?.meter_serial_number)}
                />
                {isWaterSystem ? (
                  <>
                    <MetaItem
                      label="Meter Accuracy Class"
                      value={infoValue(
                        recordData?.system?.meter_accuracy_class,
                      )}
                    />
                    {/* Calibration notes removed from water system schema */}
                  </>
                ) : (
                  <>
                    <MetaItem
                      label="Green Meter Connection Date"
                      value={infoValue(
                        recordData?.system?.green_meter_connection_date,
                      )}
                    />
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Supporting Evidence</CardTitle>
              </CardHeader>
              <CardContent>
                {isWaterSystem ? (
                  waterEvidenceUrl ? (
                    <EvidenceCard
                      title="Bulk Meter Reading"
                      url={waterEvidenceUrl}
                    />
                  ) : (
                    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                      <ImageIcon className="mx-auto mb-2 size-8 opacity-60" />
                      No meter image attached
                    </div>
                  )
                ) : solarEvidenceUrl ? (
                  <EvidenceCard
                    title="Electricity Bill Copy"
                    url={solarEvidenceUrl}
                  />
                ) : (
                  <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                    <ImageIcon className="mx-auto mb-2 size-8 opacity-60" />
                    No electricity bill image attached
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Submitted By</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <User className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {infoValue(submission.operator_name)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {infoValue(submission.operator_email)}
                    </p>
                  </div>
                </div>
                <Separator />
                <MetaItem
                  label="Submitted At"
                  value={formatDate(submission.submitted_at)}
                />
                <MetaItem
                  label="Reviewed At"
                  value={formatDate(submission.reviewed_at)}
                />
                <MetaItem
                  label="Approved At"
                  value={formatDate(submission.approved_at)}
                />
              </CardContent>
            </Card>

            {canAct ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Review Actions</CardTitle>
                  <CardDescription>
                    Add remarks for this verification decision
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Add remarks..."
                    rows={4}
                  />
                  <Button
                    className="w-full"
                    onClick={() => void verifyAction()}
                    disabled={actionLoading}
                  >
                    <CheckCircle2 className="size-4" />
                    Verify Submission
                  </Button>
                  <Button
                    className="w-full"
                    variant="destructive"
                    onClick={() => void rejectAction()}
                    disabled={actionLoading}
                  >
                    <XCircle className="size-4" />
                    Reject Submission
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            {canFinalApprove ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Final approval</CardTitle>
                  <CardDescription>
                    Manager operation or MRV COO — approve for emission use
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Optional approval remarks..."
                    rows={3}
                  />
                  <Button
                    className="w-full"
                    disabled
                  >
                    <ShieldCheck className="size-4" />
                    Approve for MRV (not available)
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Audit Trail</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>By</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditTrail.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="text-center text-muted-foreground"
                        >
                          No audit logs found
                        </TableCell>
                      </TableRow>
                    ) : (
                      auditTrail.map((log, idx) => (
                        <TableRow key={`${log.action_type}-${idx}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span
                                className={`size-2 rounded-full ${actionColor(log.action_type)}`}
                              />
                              <span className="capitalize">
                                {log.action_type}
                              </span>
                            </div>
                            {log.comment ? (
                              <p className="mt-1 max-w-[240px] truncate text-xs text-muted-foreground">
                                {log.comment}
                              </p>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            {infoValue(
                              log.performed_by_name || log.performed_by,
                            )}
                          </TableCell>
                          <TableCell>{formatDate(log.timestamp)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubmissionReview;
