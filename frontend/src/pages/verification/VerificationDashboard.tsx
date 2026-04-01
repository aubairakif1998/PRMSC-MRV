import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Clock3,
  Droplets,
  Eye,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sun,
  XCircle,
} from "lucide-react";
import { canApproveSubmissions, isStaffRole } from "../../constants/roles";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
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

type SubmissionStatus =
  | "submitted"
  | "under_review"
  | "verified"
  | "rejected"
  | "approved";
type SubmissionType = "water_system" | "solar_system";

type Submission = {
  id: string;
  status: SubmissionStatus;
  operator_name?: string;
  submission_type: SubmissionType;
  system_info?: {
    village?: string;
    tehsil?: string;
    month?: number | string;
    year?: number | string;
  };
};

type VerificationStats = {
  pending_review: number;
  verified: number;
  approved: number;
  rejected: number;
};

const statusMeta: Record<
  SubmissionStatus,
  { label: string; icon: React.ReactNode; className: string }
> = {
  submitted: {
    label: "Submitted",
    icon: <Clock3 className="size-3.5" />,
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  under_review: {
    label: "Under Review",
    icon: <Search className="size-3.5" />,
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  verified: {
    label: "Verified",
    icon: <ShieldCheck className="size-3.5" />,
    className: "border-violet-200 bg-violet-50 text-violet-700",
  },
  rejected: {
    label: "Rejected",
    icon: <XCircle className="size-3.5" />,
    className: "border-red-200 bg-red-50 text-red-700",
  },
  approved: {
    label: "Approved",
    icon: <CheckCircle2 className="size-3.5" />,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
};

const VerificationDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    getPendingSubmissions,
    verifySubmission,
    rejectSubmission,
    getVerificationStats,
  } = useVerificationApi();

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [stats, setStats] = useState<VerificationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [statusFilter, setStatusFilter] = useState<"all" | SubmissionStatus>(
    "all",
  );
  const [searchTerm, setSearchTerm] = useState("");

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const canVerifyReject = isStaffRole(user?.role);
  const canApprove = canApproveSubmissions(user?.role);

  const loadData = async (soft = false) => {
    try {
      setError("");
      if (soft) setRefreshing(true);
      else setLoading(true);

      const [subsData, statsData] = await Promise.all([
        getPendingSubmissions(),
        getVerificationStats(),
      ]);

      setSubmissions(
        ((subsData as { submissions?: Submission[] })?.submissions ||
          []) as Submission[],
      );
      setStats((statsData || null) as VerificationStats | null);
    } catch (err) {
      setError(
        getApiErrorMessage(err, "Failed to load verification dashboard"),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      if (statusFilter !== "all" && sub.status !== statusFilter) return false;
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        sub.operator_name?.toLowerCase().includes(q) ||
        sub.system_info?.village?.toLowerCase().includes(q) ||
        sub.system_info?.tehsil?.toLowerCase().includes(q) ||
        sub.id.toLowerCase().includes(q)
      );
    });
  }, [submissions, statusFilter, searchTerm]);

  const onVerify = async (submissionId: string) => {
    try {
      setActionLoading(submissionId);
      await verifySubmission(submissionId, "");
      await loadData(true);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to verify submission"));
    } finally {
      setActionLoading(null);
    }
  };

  const openRejectDialog = (submissionId: string) => {
    setRejectTarget(submissionId);
    setRejectRemarks("");
    setRejectOpen(true);
  };

  const onRejectConfirm = async () => {
    if (!rejectTarget || !rejectRemarks.trim()) return;
    try {
      setActionLoading(rejectTarget);
      await rejectSubmission(rejectTarget, rejectRemarks.trim());
      setRejectOpen(false);
      setRejectTarget(null);
      setRejectRemarks("");
      await loadData(true);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to reject submission"));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Verification Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              Review submitted records and progress them through verification.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => void loadData(true)}
            disabled={refreshing}
          >
            <RefreshCcw
              className={`size-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        {stats ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader>
                <CardDescription>Pending Review</CardDescription>
                <CardTitle className="text-2xl">
                  {stats.pending_review}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Verified</CardDescription>
                <CardTitle className="text-2xl">{stats.verified}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Approved</CardDescription>
                <CardTitle className="text-2xl">{stats.approved}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Rejected</CardDescription>
                <CardTitle className="text-2xl">{stats.rejected}</CardTitle>
              </CardHeader>
            </Card>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <Card key={idx}>
                <CardHeader>
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-8 w-16" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by operator, village, tehsil, or submission ID"
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) =>
                setStatusFilter((v as "all" | SubmissionStatus) || "all")
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {error ? (
          <Card>
            <CardContent className="pt-6 text-sm text-destructive">
              {error}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Submissions</CardTitle>
            <CardDescription>
              {filteredSubmissions.length} record(s) found
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <>
                <div className="hidden lg:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Operator / Location</TableHead>
                        <TableHead>System</TableHead>
                        <TableHead>Cycle</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSubmissions.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="h-24 text-center text-muted-foreground"
                          >
                            No submissions found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredSubmissions.map((sub) => (
                          <TableRow key={sub.id}>
                            <TableCell className="font-medium text-primary">
                              #{sub.id.slice(0, 8).toUpperCase()}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">
                                {sub.operator_name || "Unknown"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {sub.system_info?.village || "-"},{" "}
                                {sub.system_info?.tehsil || "-"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="inline-flex items-center gap-1.5">
                                {sub.submission_type === "water_system" ? (
                                  <Droplets className="size-4 text-blue-600" />
                                ) : (
                                  <Sun className="size-4 text-amber-600" />
                                )}
                                <span className="capitalize">
                                  {sub.submission_type.replace("_", " ")}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {sub.system_info?.month || "-"} /{" "}
                              {sub.system_info?.year || "-"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={statusMeta[sub.status].className}
                              >
                                {statusMeta[sub.status].icon}
                                {statusMeta[sub.status].label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="inline-flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    navigate(`/submissions/review/${sub.id}`)
                                  }
                                >
                                  <Eye className="size-4" />
                                  Review
                                </Button>
                                {canVerifyReject &&
                                (sub.status === "submitted" ||
                                  sub.status === "under_review") ? (
                                  <>
                                    <Button
                                      size="sm"
                                      onClick={() => void onVerify(sub.id)}
                                      disabled={actionLoading === sub.id}
                                    >
                                      <CheckCircle2 className="size-4" />
                                      Verify
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => openRejectDialog(sub.id)}
                                      disabled={actionLoading === sub.id}
                                    >
                                      <XCircle className="size-4" />
                                      Reject
                                    </Button>
                                  </>
                                ) : null}
                                {canApprove && sub.status === "verified" ? (
                                  <Button size="sm" variant="secondary" disabled>
                                    <ShieldCheck className="size-4" />
                                    Approve (not available)
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="grid gap-3 lg:hidden">
                  {filteredSubmissions.length === 0 ? (
                    <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
                      No submissions found
                    </div>
                  ) : (
                    filteredSubmissions.map((sub) => (
                      <div
                        key={sub.id}
                        className="rounded-lg border bg-background p-4"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-semibold text-primary">
                            #{sub.id.slice(0, 8).toUpperCase()}
                          </span>
                          <Badge
                            variant="outline"
                            className={statusMeta[sub.status].className}
                          >
                            {statusMeta[sub.status].icon}
                            {statusMeta[sub.status].label}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium">
                          {sub.operator_name || "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {sub.system_info?.village || "-"},{" "}
                          {sub.system_info?.tehsil || "-"}
                        </p>
                        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                          {sub.submission_type === "water_system" ? (
                            <Droplets className="size-3.5 text-blue-600" />
                          ) : (
                            <Sun className="size-3.5 text-amber-600" />
                          )}
                          <span className="capitalize">
                            {sub.submission_type.replace("_", " ")}
                          </span>
                          <span>-</span>
                          <span>
                            {sub.system_info?.month || "-"} /{" "}
                            {sub.system_info?.year || "-"}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              navigate(`/submissions/review/${sub.id}`)
                            }
                          >
                            <Eye className="size-4" />
                            Review
                          </Button>
                          {canVerifyReject &&
                          (sub.status === "submitted" ||
                            sub.status === "under_review") ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() => void onVerify(sub.id)}
                                disabled={actionLoading === sub.id}
                              >
                                <CheckCircle2 className="size-4" />
                                Verify
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => openRejectDialog(sub.id)}
                                disabled={actionLoading === sub.id}
                              >
                                <XCircle className="size-4" />
                                Reject
                              </Button>
                            </>
                          ) : null}
                          {canApprove && sub.status === "verified" ? (
                            <Button size="sm" variant="secondary" disabled>
                              <ShieldCheck className="size-4" />
                              Approve (not available)
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Submission</DialogTitle>
            <DialogDescription>
              Provide a clear rejection reason. This will be visible in the
              submission trail.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectRemarks}
            onChange={(e) => setRejectRemarks(e.target.value)}
            placeholder="Example: Meter image is unclear. Please upload a higher-quality image and resubmit."
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void onRejectConfirm()}
              disabled={!rejectRemarks.trim() || !rejectTarget}
            >
              Reject Submission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VerificationDashboard;
