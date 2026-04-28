import { useEffect, useMemo, useState } from "react";
import { FileText, RefreshCcw } from "lucide-react";
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
import { getApiErrorMessage } from "../../../lib/api-error";
import { getActiveWaterSystemCalibrationCertificates } from "../../../services/tehsilManagerOperatorService";

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

const fmtDate = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB");
};

export default function CalibrationCertificates() {
  const [rows, setRows] = useState<ActiveCertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (soft = false) => {
    try {
      if (soft) setRefreshing(true);
      else setLoading(true);
      const res = (await getActiveWaterSystemCalibrationCertificates()) as ActiveCertRow[];
      setRows(Array.isArray(res) ? res : []);
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Could not load calibration certificates"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const expiringSoonCount = useMemo(() => {
    const now = new Date();
    const soon = new Date(now);
    soon.setDate(soon.getDate() + 30);
    return rows.filter((r) => {
      const v = r.certificate.expiry_date;
      if (!v) return false;
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return false;
      return d <= soon;
    }).length;
  }, [rows]);

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Calibration certificates
            </h1>
            <p className="text-sm text-muted-foreground">
              Active certificate per water system in your scope.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {expiringSoonCount > 0 ? (
              <Badge variant="outline">
                {expiringSoonCount} expiring in 30 days
              </Badge>
            ) : null}
            <Button
              variant="outline"
              onClick={() => void load(true)}
              disabled={refreshing}
            >
              <RefreshCcw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Active certificates</CardTitle>
            <CardDescription>
              {loading ? "Loading…" : `${rows.length} water system(s) with active certificate`}
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
                      <TableHead>File</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                          No active certificates found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((r) => (
                        <TableRow key={r.certificate.id}>
                          <TableCell className="font-medium">
                            {r.water_system.tehsil || "—"}
                          </TableCell>
                          <TableCell>{r.water_system.village || "—"}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {r.water_system.unique_identifier || "—"}
                          </TableCell>
                          <TableCell>{fmtDate(r.certificate.uploaded_at)}</TableCell>
                          <TableCell>{fmtDate(r.certificate.expiry_date)}</TableCell>
                          <TableCell className="max-w-[280px] truncate">
                            {fileNameFromUrl(r.certificate.file_url)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(r.certificate.file_url, "_blank")}
                            >
                              <FileText className="size-4" />
                              View
                            </Button>
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

