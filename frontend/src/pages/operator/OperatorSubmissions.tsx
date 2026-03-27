import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useOperatorApi } from "../../hooks";
import { getApiErrorMessage } from "../../lib/api-error";
import {
  Search,
  RefreshCw,
  FileText,
  Building,
  Sun,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Spinner } from "../../components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";

const STATUS_CONFIG = {
  draft: {
    label: "Draft",
    color: "#6366f1",
    variant: "secondary" as const,
    icon: <Clock className="size-3.5" />,
  },
  submitted: {
    label: "Submitted",
    variant: "outline" as const,
    icon: <TrendingUp className="size-3.5" />,
  },
  under_review: {
    label: "Under Review",
    variant: "outline" as const,
    icon: <Search className="size-3.5" />,
  },
  verified: {
    label: "Verified",
    variant: "secondary" as const,
    icon: <CheckCircle className="size-3.5" />,
  },
  rejected: {
    label: "Rejected",
    variant: "destructive" as const,
    icon: <AlertCircle className="size-3.5" />,
  },
  approved: {
    label: "Approved",
    variant: "secondary" as const,
    icon: <CheckCircle className="size-3.5" />,
  },
};

const OperatorSubmissions = ({
  submissionType,
}: {
  submissionType: string;
}) => {
  const { getMySubmissions } = useOperatorApi();
  const navigate = useNavigate();

  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadData();
  }, [filter, submissionType]);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getMySubmissions(
        filter !== "all" ? filter : undefined,
      );
      setSubmissions(data.submissions || []);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Failed to load submissions"));
    } finally {
      setLoading(false);
    }
  };

  const filteredSubmissions = submissions.filter((sub: any) => {
    if (submissionType && sub.submission_type !== submissionType) return false;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        sub.system_info?.village?.toLowerCase().includes(search) ||
        sub.system_info?.tehsil?.toLowerCase().includes(search) ||
        sub.id.toLowerCase().includes(search)
      );
    }
    return true;
  });

  // Calculate summary stats
  const stats = {
    total: filteredSubmissions.length,
    pending: filteredSubmissions.filter(
      (s: any) => s.status === "submitted" || s.status === "under_review",
    ).length,
    approved: filteredSubmissions.filter(
      (s: any) => s.status === "approved" || s.status === "verified",
    ).length,
    rejected: filteredSubmissions.filter((s: any) => s.status === "rejected")
      .length,
  };

  const getStatusBadge = (status: keyof typeof STATUS_CONFIG) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
    return (
      <Badge variant={config.variant} className="gap-1 px-2 py-1">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getSystemIcon = (type: string) => {
    return type === "water_system" ? (
      <Building size={18} style={{ color: "#6366f1" }} />
    ) : (
      <Sun size={18} style={{ color: "#f59e0b" }} />
    );
  };

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="inline-flex items-center gap-3 rounded-lg border bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          <Spinner className="size-4" />
          Preparing your records...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <h1 className="text-2xl font-black capitalize tracking-tight text-slate-900 md:text-3xl">
            {submissionType
              ? submissionType.replace("_", " ") + " Submissions"
              : "Submissions Portal"}
            </h1>
            <p className="text-sm text-slate-600">
              Track and manage your reporting workflow with clear status visibility.
            </p>
          </div>
          <Button onClick={loadData} variant="outline" className="gap-2">
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <StatCard
            title="Total Reports"
            value={stats.total}
            icon={<FileText className="size-4 text-indigo-600" />}
          />
          <StatCard
            title="Awaiting Review"
            value={stats.pending}
            icon={<Clock className="size-4 text-amber-600" />}
          />
          <StatCard
            title="Verified / Approved"
            value={stats.approved}
            icon={<CheckCircle className="size-4 text-emerald-600" />}
          />
          <StatCard
            title="Issues / Rejected"
            value={stats.rejected}
            icon={<AlertCircle className="size-4 text-rose-600" />}
          />
        </div>

        <Card className="rounded-2xl border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Search & Status</CardTitle>
            <CardDescription>Narrow down your submissions quickly.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search village, tehsil, or submission id..."
                className="h-10 border-slate-200 pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                "all",
                "draft",
                "submitted",
                "under_review",
                "verified",
                "approved",
                "rejected",
              ].map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={filter === s ? "default" : "outline"}
                  className={filter === s ? "bg-indigo-600 hover:bg-indigo-700" : ""}
                  onClick={() => setFilter(s)}
                >
                  {s.replace("_", " ")}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200">
          <CardContent className="pt-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Submission ID</TableHead>
                  <TableHead>System Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <AnimatePresence mode="wait">
                <TableBody>
                  {filteredSubmissions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center">
                        <div className="flex flex-col items-center gap-2 text-slate-500">
                          <FileText className="size-10 text-slate-300" />
                          <p>No matching records found.</p>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setFilter("all");
                              setSearchTerm("");
                            }}
                          >
                            Clear all filters
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSubmissions.map((sub: any) => (
                      <motion.tr
                        key={sub.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="cursor-pointer border-b transition-colors hover:bg-slate-50"
                        onClick={() => navigate(`/operator/review/${sub.id}`)}
                      >
                        <TableCell className="font-semibold text-indigo-600">
                          #{sub.id.substring(0, 8).toUpperCase()}
                        </TableCell>
                        <TableCell>
                          <div className="inline-flex items-center gap-2">
                            {getSystemIcon(sub.submission_type)}
                            <span className="capitalize text-slate-700">
                              {sub.submission_type.replace("_", " ")}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-slate-800">
                              {sub.system_info?.village || "-"}
                            </p>
                            <p className="text-xs text-slate-500">
                              {sub.system_info?.tehsil || "-"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {sub.system_info?.month}/{sub.system_info?.year}
                          </Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(sub.status)}</TableCell>
                        <TableCell className="text-slate-600">
                          {formatDate(sub.submitted_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="gap-1">
                            Details <ArrowRight className="size-3.5" />
                          </Button>
                        </TableCell>
                      </motion.tr>
                    ))
                  )}
                </TableBody>
              </AnimatePresence>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const StatCard = ({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) => (
  <Card className="rounded-xl border-slate-200">
    <CardContent className="py-4">
      <div className="mb-2 inline-flex rounded-lg bg-slate-100 p-2">{icon}</div>
      <p className="text-2xl font-black text-slate-900">{value}</p>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
    </CardContent>
  </Card>
);
export default OperatorSubmissions;
