import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Clock,
  Droplets,
  ExternalLink,
  Eye,
  ImageIcon,
  MapPin,
  Search,
  ShieldCheck,
  Sun,
  User,
  XOctagon,
} from "lucide-react";
import { useVerificationApi } from "../../hooks";
import { getApiErrorMessage } from "../../lib/api-error";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Skeleton } from "../../components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

type SubmissionType = "water_system" | "solar_system";
type SubmissionStatus =
  | "submitted"
  | "under_review"
  | "verified"
  | "rejected"
  | "approved";

type VerificationSubmission = {
  id: string;
  submission_type: SubmissionType;
  status: SubmissionStatus;
  operator_name?: string;
  operator_email?: string;
  submitted_at: string;
  reviewed_at?: string | null;
  approved_at?: string | null;
  remarks?: string | null;
  system_info?: {
    village?: string;
    tehsil?: string;
    uid?: string;
    month?: number | string;
    year?: number | string;
    bulk_meter_image?: string;
    bulk_meter_image_url?: string;
    electricity_bill_image?: string;
    electricity_bill_url?: string;
    electricity_bill_image_url?: string;
    total_water_pumped?: number | string;
    energy_exported_to_grid?: number | string;
    energy_consumed_from_grid?: number | string;
  };
};

const STATUS_CONFIG: Record<
  SubmissionStatus,
  { label: string; className: string; icon: typeof Clock }
> = {
  submitted: {
    label: "Pending Review",
    className: "border-yellow-200 bg-yellow-50 text-yellow-700",
    icon: Clock,
  },
  under_review: {
    label: "Under Review",
    className: "border-blue-200 bg-blue-50 text-blue-700",
    icon: Eye,
  },
  verified: {
    label: "Verified",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    className: "border-red-200 bg-red-50 text-red-700",
    icon: XOctagon,
  },
  approved: {
    label: "Approved",
    className: "border-violet-200 bg-violet-50 text-violet-700",
    icon: ShieldCheck,
  },
};

const getImageUrl = (path?: string) => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const parts = path.split(/[\\/]/);
  const filename = parts[parts.length - 1];
  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
  return `${baseUrl}/api/uploads/${filename}`;
};

const resolveImageUrl = (sub: VerificationSubmission) => {
  const info = sub.system_info || {};
  const raw =
    sub.submission_type === "water_system"
      ? info.bulk_meter_image_url || info.bulk_meter_image
      : info.electricity_bill_url ||
        info.electricity_bill_image_url ||
        info.electricity_bill_image;
  return getImageUrl(raw);
};

const VerificationsPage = () => {
  const { getPendingSubmissions } = useVerificationApi();
  const navigate = useNavigate();

  const [submissions, setSubmissions] = useState<VerificationSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await getPendingSubmissions();
        setSubmissions(
          ((data as { submissions?: VerificationSubmission[] }).submissions ||
            []) as VerificationSubmission[],
        );
      } catch (err) {
        const message = getApiErrorMessage(err, "Failed to load submissions");
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: submissions.length };
    for (const sub of submissions) {
      counts[sub.status] = (counts[sub.status] || 0) + 1;
    }
    return counts;
  }, [submissions]);

  const filtered = useMemo(() => {
    return submissions.filter((sub) => {
      if (typeFilter !== "all" && sub.submission_type !== typeFilter)
        return false;
      if (statusFilter !== "all" && sub.status !== statusFilter) return false;
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      const info = sub.system_info || {};
      return (
        info.village?.toLowerCase().includes(q) ||
        info.tehsil?.toLowerCase().includes(q) ||
        info.uid?.toLowerCase().includes(q) ||
        sub.operator_name?.toLowerCase().includes(q)
      );
    });
  }, [submissions, typeFilter, statusFilter, searchTerm]);

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-14 w-full" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-80 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Submissions
          </h1>
          <p className="text-sm text-muted-foreground">
            Browse all operator submissions — review evidence, track status, and
            take action.
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="flex flex-col gap-3 pt-5 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by UID, village, tehsil, or operator…"
                className="pl-9"
              />
            </div>

            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    All statuses ({statusCounts.all || 0})
                  </SelectItem>
                  <SelectItem value="submitted">
                    Pending review ({statusCounts.submitted || 0})
                  </SelectItem>
                  <SelectItem value="under_review">
                    Under review ({statusCounts.under_review || 0})
                  </SelectItem>
                  <SelectItem value="verified">
                    Verified ({statusCounts.verified || 0})
                  </SelectItem>
                  <SelectItem value="rejected">
                    Rejected ({statusCounts.rejected || 0})
                  </SelectItem>
                  <SelectItem value="approved">
                    Approved ({statusCounts.approved || 0})
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? "all")}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="System" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All systems</SelectItem>
                  <SelectItem value="water_system">Water supply</SelectItem>
                  <SelectItem value="solar_system">Solar energy</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Error state */}
        {error ? (
          <Card>
            <CardContent className="pt-6 text-sm text-destructive">
              {error}
            </CardContent>
          </Card>
        ) : null}

        {/* Empty state */}
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
              <ImageIcon className="size-10 opacity-40" />
              <p className="text-sm font-medium">
                No submissions match your filters.
              </p>
              {(statusFilter !== "all" || typeFilter !== "all") && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    setStatusFilter("all");
                    setTypeFilter("all");
                    setSearchTerm("");
                  }}
                >
                  Clear all filters
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Showing {filtered.length} of {submissions.length} submission
              {submissions.length !== 1 ? "s" : ""}
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((sub) => {
                const info = sub.system_info || {};
                const isWater = sub.submission_type === "water_system";
                const imageUrl = resolveImageUrl(sub);
                const statusCfg = STATUS_CONFIG[sub.status] || STATUS_CONFIG.submitted;
                const StatusIcon = statusCfg.icon;

                return (
                  <Card key={sub.id} className="group overflow-hidden">
                    {/* Image area */}
                    <div className="relative h-44 bg-muted">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt="Evidence"
                          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex size-full flex-col items-center justify-center gap-1">
                          <ImageIcon className="size-8 text-muted-foreground/30" />
                          <span className="text-[10px] font-medium text-muted-foreground/50">
                            No evidence attached
                          </span>
                        </div>
                      )}

                      {/* System type badge */}
                      <Badge
                        variant="outline"
                        className={`absolute left-3 top-3 border-none text-[10px] font-bold uppercase tracking-wider ${
                          isWater
                            ? "bg-blue-600/90 text-white"
                            : "bg-amber-500/90 text-white"
                        }`}
                      >
                        {isWater ? (
                          <Droplets className="size-3" />
                        ) : (
                          <Sun className="size-3" />
                        )}
                        {isWater ? "Water" : "Solar"}
                      </Badge>

                      {/* Status badge */}
                      <Badge
                        variant="outline"
                        className={`absolute right-3 top-3 text-[10px] font-semibold ${statusCfg.className}`}
                      >
                        <StatusIcon className="size-3" />
                        {statusCfg.label}
                      </Badge>

                      {/* Image actions (on hover) */}
                      {imageUrl ? (
                        <div className="absolute bottom-3 right-3 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <Button
                            size="icon-sm"
                            variant="secondary"
                            onClick={() => setPreviewUrl(imageUrl)}
                          >
                            <Eye className="size-3.5" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="secondary"
                            onClick={() => window.open(imageUrl, "_blank")}
                          >
                            <ExternalLink className="size-3.5" />
                          </Button>
                        </div>
                      ) : null}

                      {/* Location overlay */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-8">
                        <p className="text-sm font-semibold text-white">
                          {info.village || "Unknown village"}
                        </p>
                        <p className="flex items-center gap-1 text-xs text-white/80">
                          <MapPin className="size-3" />
                          {info.tehsil || "—"}
                        </p>
                      </div>
                    </div>

                    {/* Details */}
                    <CardContent className="space-y-3 pt-4">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-md border bg-muted/20 px-2.5 py-1.5">
                          <p className="text-[10px] text-muted-foreground">
                            UID
                          </p>
                          <p className="truncate text-xs font-medium">
                            {info.uid || "N/A"}
                          </p>
                        </div>
                        <div className="rounded-md border bg-muted/20 px-2.5 py-1.5">
                          <p className="text-[10px] text-muted-foreground">
                            Cycle
                          </p>
                          <p className="text-xs font-medium">
                            {info.month || "—"} / {info.year || "—"}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <CalendarDays className="size-3" /> Submitted
                          </span>
                          <span className="font-medium">
                            {new Date(sub.submitted_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <User className="size-3" /> Operator
                          </span>
                          <span className="font-medium">
                            {sub.operator_name || "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Activity className="size-3" />{" "}
                            {isWater ? "Flow reading" : "Export"}
                          </span>
                          <Badge
                            variant="outline"
                            className={
                              isWater
                                ? "border-blue-200 bg-blue-50 text-blue-700"
                                : "border-amber-200 bg-amber-50 text-amber-700"
                            }
                          >
                            {isWater
                              ? `${info.total_water_pumped ?? "—"} m³`
                              : `${info.energy_exported_to_grid ?? "—"} kWh`}
                          </Badge>
                        </div>
                      </div>

                      {sub.remarks ? (
                        <p className="truncate rounded-md border border-dashed px-2 py-1.5 text-[11px] italic text-muted-foreground">
                          {sub.remarks}
                        </p>
                      ) : null}

                      <Button
                        variant="outline"
                        className="w-full"
                        size="sm"
                        onClick={() =>
                          navigate(`/submissions/review/${sub.id}`)
                        }
                      >
                        <Eye className="size-4" />
                        {sub.status === "submitted"
                          ? "Review & Verify"
                          : "View Details"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Image preview modal */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-3xl p-2">
          <DialogTitle className="sr-only">Image Preview</DialogTitle>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Full preview"
              className="max-h-[80vh] w-full rounded-lg object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VerificationsPage;
