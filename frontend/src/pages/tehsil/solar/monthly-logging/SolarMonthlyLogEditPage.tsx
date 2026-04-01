import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Save,
  Trash2,
  Zap,
} from "lucide-react";

import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../../components/ui/dialog";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Separator } from "../../../../components/ui/separator";
import { Skeleton } from "../../../../components/ui/skeleton";
import { Textarea } from "../../../../components/ui/textarea";
import { tehsilRoutes } from "../../../../constants/routes";
import { useAuth } from "../../../../contexts/AuthContext";
import { useTehsilManagerOperatorApi } from "../../../../hooks";
import { getApiErrorMessage } from "../../../../lib/api-error";
import { getSolarSupplyRecord as fetchSolarSupplyRecord } from "../../../../services/tehsilManagerOperatorService";
import type { SolarMonthlySupplyRecordDetail } from "../../../../types/api";
import { TEHSIL_OPTIONS } from "../../../../utils/locationData";

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

function canonicalTehsil(raw: string): string | null {
  const t = raw.trim().toUpperCase();
  return (TEHSIL_OPTIONS as readonly string[]).find((o) => o === t) ?? null;
}

function EditPageSkeleton() {
  return (
    <div className="min-h-screen bg-muted/30 p-4 pb-16 md:p-6">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-10 w-full max-w-md" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-full max-w-sm" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-36 w-full" />
            <div className="flex justify-between gap-2 pt-4">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-36" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SolarMonthlyLogEditPage() {
  const { recordId } = useParams<{ recordId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { updateSolarSupplyRecord, deleteSolarSupplyRecord, uploadImage } =
    useTehsilManagerOperatorApi();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [record, setRecord] = useState<SolarMonthlySupplyRecordDetail | null>(
    null,
  );

  const [energyConsumed, setEnergyConsumed] = useState("");
  const [energyExported, setEnergyExported] = useState("");
  const [remarks, setRemarks] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /** Stable string so we only re-fetch when the user’s tehsil list actually changes. */
  const profileTehsilsKey = useMemo(
    () => (user?.tehsils ?? []).slice().sort().join("|"),
    [user?.tehsils],
  );

  useEffect(() => {
    if (!recordId?.trim()) {
      setLoadError("Missing record id.");
      setLoading(false);
      setRecord(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    (async () => {
      try {
        const rec = (await fetchSolarSupplyRecord(recordId)) as SolarMonthlySupplyRecordDetail;
        if (cancelled) return;

        if (!rec?.id) {
          setLoadError("Record not found.");
          setRecord(null);
          return;
        }

        const fromUser = (user?.tehsils ?? [])
          .map(canonicalTehsil)
          .filter((x): x is string => Boolean(x));
        const hasResolvedProfileTehsils = fromUser.length > 0;
        const tehsilSelectOptions = hasResolvedProfileTehsils
          ? [...new Set(fromUser)]
          : [...TEHSIL_OPTIONS];

        if (hasResolvedProfileTehsils) {
          const c = canonicalTehsil(String(rec.tehsil ?? ""));
          const allowed = new Set(tehsilSelectOptions);
          if (!c || !allowed.has(c)) {
            setLoadError("This record belongs to another tehsil.");
            setRecord(null);
            return;
          }
        }

        setRecord(rec);
        setEnergyConsumed(
          rec.energy_consumed_from_grid != null &&
            String(rec.energy_consumed_from_grid) !== ""
            ? String(rec.energy_consumed_from_grid)
            : "",
        );
        setEnergyExported(
          rec.energy_exported_to_grid != null &&
            String(rec.energy_exported_to_grid) !== ""
            ? String(rec.energy_exported_to_grid)
            : "",
        );
        setRemarks(rec.remarks?.trim() ? String(rec.remarks) : "");
        setAttachment(null);
      } catch (e: unknown) {
        if (!cancelled) {
          setLoadError(getApiErrorMessage(e, "Failed to load record"));
          setRecord(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [recordId, profileTehsilsKey]);

  const monthLabel =
    record && record.month >= 1 && record.month <= 12
      ? MONTH_NAMES[record.month]
      : record
        ? `Month ${record.month}`
        : "";

  const save = async () => {
    if (!recordId || !record) return;
    const imp = parseFloat(energyConsumed);
    const exp = parseFloat(energyExported);
    if (
      energyConsumed.trim() === "" ||
      energyExported.trim() === "" ||
      Number.isNaN(imp) ||
      Number.isNaN(exp)
    ) {
      toast.error(
        "Enter import and export values in kWh (numbers; 0 is allowed).",
      );
      return;
    }

    setSaving(true);
    try {
      let imagePath: string | null = null;
      if (attachment) {
        const uploadRes = await uploadImage(attachment, "solar", recordId);
        const raw = uploadRes.image_url ?? uploadRes.path;
        imagePath = typeof raw === "string" ? raw : null;
      }

      const payload: Record<string, unknown> = {
        energy_consumed_from_grid: energyConsumed,
        energy_exported_to_grid: energyExported,
        remarks: remarks.trim() || null,
      };
      if (imagePath) {
        payload.image_url = imagePath;
        payload.image_path = imagePath;
      }

      const res = (await updateSolarSupplyRecord(recordId, payload)) as {
        updated_at?: string;
      };

      setRecord((prev) => {
        if (!prev) return prev;
        const next: SolarMonthlySupplyRecordDetail = {
          ...prev,
          energy_consumed_from_grid: imp,
          energy_exported_to_grid: exp,
          remarks: remarks.trim() ? remarks.trim() : null,
          electricity_bill_image_url: imagePath
            ? imagePath
            : prev.electricity_bill_image_url ?? null,
          updated_at: res.updated_at ?? prev.updated_at ?? null,
        };
        return next;
      });
      toast.success("Monthly log updated");
      setAttachment(null);
      const from = (location.state as { from?: string } | null)?.from;
      if (typeof from === "string" && from.trim()) {
        navigate(from, { replace: true });
      } else {
        navigate(-1);
      }
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!recordId) return;
    setDeleting(true);
    try {
      await deleteSolarSupplyRecord(recordId);
      toast.success("Monthly record deleted");
      navigate(tehsilRoutes.solarMonthlyLogging);
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Delete failed"));
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="relative min-h-screen bg-muted/30">
        <div className="pointer-events-none absolute inset-0 flex items-start justify-center bg-background/40 pt-24 backdrop-blur-[1px]">
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium shadow-sm">
            <Loader2 className="size-4 animate-spin text-primary" />
            Loading record…
          </div>
        </div>
        <EditPageSkeleton />
      </div>
    );
  }

  if (loadError || !record) {
    return (
      <div className="min-h-screen bg-muted/30 p-4 md:p-6">
        <div className="mx-auto w-full max-w-lg">
          <Button
            variant="outline"
            size="sm"
            className="mb-4 gap-2"
            onClick={() => navigate(tehsilRoutes.solarMonthlyLogging)}
          >
            <ArrowLeft className="size-4" />
            Back to Solar Monthly Logging
          </Button>
          <Card className="border-rose-200 bg-rose-50/50">
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <AlertCircle className="size-12 text-rose-600" />
              <p className="text-base font-semibold text-slate-900">
                Could not load this log
              </p>
              <p className="text-sm text-slate-600">{loadError}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4 pb-16 md:p-6">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => navigate(tehsilRoutes.solarMonthlyLogging)}
            >
              <ArrowLeft className="size-4" />
              Solar Monthly Logging
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                Edit monthly solar log
              </h1>
              <Badge variant="outline">{monthLabel}</Badge>
              <Badge variant="secondary">{record.year}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {record.tehsil} · {record.village}
              {(record.settlement ?? "").trim()
                ? ` · ${(record.settlement ?? "").trim()}`
                : ""}
            </p>
          </div>
        </div>

        <Card className="overflow-hidden border-border/80 shadow-sm">
          <CardHeader className="border-b border-border/60 bg-card">
            <CardTitle>Energy & evidence</CardTitle>
            <CardDescription>
              Update grid import/export (kWh) and optional bill image for this
              month.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="imp">Energy consumed from grid (kWh)</Label>
                <Input
                  id="imp"
                  inputMode="decimal"
                  value={energyConsumed}
                  onChange={(e) => setEnergyConsumed(e.target.value)}
                  placeholder="0"
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exp">Energy exported to grid (kWh)</Label>
                <Input
                  id="exp"
                  inputMode="decimal"
                  value={energyExported}
                  onChange={(e) => setEnergyExported(e.target.value)}
                  placeholder="0"
                  disabled={saving}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rm">Remarks</Label>
              <Textarea
                id="rm"
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional notes"
                disabled={saving}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Electricity bill image</Label>
              {record.electricity_bill_image_url?.trim() && !attachment ? (
                <a
                  href={record.electricity_bill_image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  <ExternalLink className="size-3.5" />
                  View current file
                </a>
              ) : null}
              <button
                type="button"
                disabled={saving}
                className="w-full rounded-xl border-2 border-dashed border-border bg-muted/30 px-4 py-8 text-center transition-colors hover:border-primary/40 hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-60"
                onClick={() =>
                  document.getElementById("solar-monthly-edit-evidence")?.click()
                }
              >
                <input
                  id="solar-monthly-edit-evidence"
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
                />
                {!attachment ? (
                  <>
                    <Zap className="mx-auto mb-2 size-10 text-muted-foreground/50" />
                    <p className="text-sm font-medium text-foreground">
                      Tap to upload or replace bill photo
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      PNG or JPG — stored when you save
                    </p>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mx-auto mb-2 size-10 text-primary" />
                    <p className="text-sm font-semibold">{attachment.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Tap to choose a different file
                    </p>
                  </>
                )}
              </button>
            </div>

            <div className="flex flex-col gap-3 border-t border-border/60 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="outline"
                className="gap-2 text-destructive hover:bg-destructive/10"
                onClick={() => setDeleteOpen(true)}
                disabled={saving}
              >
                <Trash2 className="size-4" />
                Delete record
              </Button>
              <Button
                type="button"
                className="gap-2"
                onClick={() => void save()}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Save changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this monthly log?</DialogTitle>
            <DialogDescription>
              This removes {monthLabel} {record.year} for {record.village}. This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void remove()}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
