import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Lock, Save, Trash2 } from "lucide-react";

import Toast from "../../../../components/Toast";
import { Button } from "../../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/card";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Separator } from "../../../../components/ui/separator";
import { Textarea } from "../../../../components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "../../../../components/ui/alert";
import { Badge } from "../../../../components/ui/badge";
import { Skeleton } from "../../../../components/ui/skeleton";
import { tehsilRoutes } from "../../../../constants/routes";
import { getApiErrorMessage } from "../../../../lib/api-error";
import {
  deleteSolarSystem,
  getSolarSystem,
  updateSolarSystem,
} from "../../../../services/tehsilManagerOperatorService";
import type { SolarSystemRow } from "../../../../types/api";

type ToastType = "success" | "error";

export default function SolarSiteEditPage() {
  const navigate = useNavigate();
  const { systemId } = useParams();
  const id = String(systemId || "").trim();

  const [toast, setToast] = useState<{ message: string; type: ToastType }>({
    message: "",
    type: "success",
  });
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [site, setSite] = useState<SolarSystemRow | null>(null);
  const [monthlyLogCount, setMonthlyLogCount] = useState<number>(0);

  const [formData, setFormData] = useState({
    latitude: "",
    longitude: "",
    installation_location: "",
    solar_panel_capacity: "",
    inverter_capacity: "",
    inverter_serial_number: "",
    installation_date: "",
    meter_model: "",
    meter_serial_number: "",
    green_meter_connection_date: "",
    remarks: "",
  });

  const lastLoadedId = useRef<string>("");
  const isResolved = Boolean(site?.id);
  const showShimmers = loadingInitial || (Boolean(id) && !isResolved);

  const load = async () => {
    if (!id) return;
    if (lastLoadedId.current === id) return;
    lastLoadedId.current = id;

    setLoadingInitial(true);
    try {
      const s = (await getSolarSystem(id)) as SolarSystemRow;
      setSite(s);
      setMonthlyLogCount(typeof s.monthly_log_count === "number" ? s.monthly_log_count : 0);

      setFormData({
        latitude: s.latitude != null ? String(s.latitude) : "",
        longitude: s.longitude != null ? String(s.longitude) : "",
        installation_location: String(s.installation_location ?? ""),
        solar_panel_capacity: s.solar_panel_capacity != null ? String(s.solar_panel_capacity) : "",
        inverter_capacity: s.inverter_capacity != null ? String(s.inverter_capacity) : "",
        inverter_serial_number: String(s.inverter_serial_number ?? ""),
        installation_date: s.installation_date ? String(s.installation_date).slice(0, 10) : "",
        meter_model: String(s.meter_model ?? ""),
        meter_serial_number: String(s.meter_serial_number ?? ""),
        green_meter_connection_date: s.green_meter_connection_date
          ? String(s.green_meter_connection_date).slice(0, 10)
          : "",
        remarks: String(s.remarks ?? ""),
      });
    } catch (e: unknown) {
      setToast({ message: getApiErrorMessage(e, "Failed to load solar site"), type: "error" });
    } finally {
      setLoadingInitial(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const canSave = useMemo(() => {
    if (!isResolved) return false;
    return (
      formData.installation_location.trim() &&
      formData.solar_panel_capacity.trim() &&
      formData.inverter_capacity.trim() &&
      formData.inverter_serial_number.trim() &&
      formData.installation_date.trim() &&
      formData.meter_model.trim() &&
      formData.meter_serial_number.trim() &&
      formData.green_meter_connection_date.trim()
    );
  }, [formData, isResolved]);

  const onChange =
    (field: keyof typeof formData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const save = async () => {
    if (!isResolved) return;
    setSaving(true);
    try {
      await updateSolarSystem(site!.id, {
        tehsil: site?.tehsil,
        village: site?.village,
        settlement: site?.settlement ?? "",
        ...formData,
      });
      setToast({ message: "✅ Solar site updated!", type: "success" });
      setTimeout(() => navigate(tehsilRoutes.solarSites), 900);
    } catch (e: unknown) {
      setToast({ message: getApiErrorMessage(e, "Update failed"), type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!isResolved) return;
    if (monthlyLogCount > 0) {
      setToast({
        message:
          "This site has monthly energy submissions and cannot be deleted. Remove those records first.",
        type: "error",
      });
      return;
    }
    if (!window.confirm("Delete this solar site? This cannot be undone.")) return;

    setDeleting(true);
    try {
      await deleteSolarSystem(site!.id);
      setToast({ message: "Solar site deleted.", type: "success" });
      setTimeout(() => navigate(tehsilRoutes.solarSites), 700);
    } catch (e: unknown) {
      setToast({ message: getApiErrorMessage(e, "Delete failed"), type: "error" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-muted/30 p-4 md:p-6"
    >
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: "", type: "success" })}
      />

      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-6 flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                Edit solar site
              </h1>
              <Badge variant="outline">Edit mode</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Location is locked. Update technical and metering fields below.
            </p>
          </div>
        </div>

        {!id ? (
          <Alert className="border-amber-200 bg-amber-50 text-amber-950">
            <AlertTitle>Missing system id</AlertTitle>
            <AlertDescription>
              Open this page from Solar sites list.
            </AlertDescription>
          </Alert>
        ) : null}

        <Card className="mb-6 border-slate-200">
          <CardHeader>
            <CardTitle className="text-base">Site</CardTitle>
            <CardDescription>Read-only identity & location</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {showShimmers ? (
              <>
                {Array.from({ length: 5 }).map((_, idx) => (
                  <div key={idx} className="rounded-lg border bg-background p-3">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="mt-2 h-4 w-full" />
                  </div>
                ))}
              </>
            ) : (
              <>
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-[11px] text-muted-foreground">System ID</p>
                  <p className="mt-1 font-mono text-xs">{site?.id || "—"}</p>
                </div>
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-[11px] text-muted-foreground">UID</p>
                  <p className="mt-1 font-mono text-xs">
                    {site?.unique_identifier || "—"}
                  </p>
                </div>
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-[11px] text-muted-foreground">Tehsil</p>
                  <p className="mt-1 font-medium">{site?.tehsil || "—"}</p>
                </div>
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-[11px] text-muted-foreground">Village</p>
                  <p className="mt-1 font-medium">{site?.village || "—"}</p>
                </div>
                <div className="rounded-lg border bg-background p-3 md:col-span-2">
                  <p className="text-[11px] text-muted-foreground">Settlement</p>
                  <p className="mt-1 font-medium">{site?.settlement || "—"}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {!showShimmers ? (
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-base">Editable fields</CardTitle>
              <CardDescription>Coordinates, assets, and metering</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Latitude (Optional)</Label>
                  <Input
                    type="number"
                    value={formData.latitude}
                    onChange={onChange("latitude")}
                    disabled={saving || deleting || !isResolved}
                    inputMode="decimal"
                    placeholder="e.g. 29.99812"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Longitude (Optional)</Label>
                  <Input
                    type="number"
                    value={formData.longitude}
                    onChange={onChange("longitude")}
                    disabled={saving || deleting || !isResolved}
                    inputMode="decimal"
                    placeholder="e.g. 73.25291"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Installation type</Label>
                  <Input
                    value={formData.installation_location}
                    onChange={onChange("installation_location")}
                    disabled={saving || deleting || !isResolved}
                  />
                </div>
                <div className="space-y-2">
                  <Label>PV capacity (kWp)</Label>
                  <Input
                    type="number"
                    value={formData.solar_panel_capacity}
                    onChange={onChange("solar_panel_capacity")}
                    disabled={saving || deleting || !isResolved}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Inverter capacity (kVA)</Label>
                  <Input
                    type="number"
                    value={formData.inverter_capacity}
                    onChange={onChange("inverter_capacity")}
                    disabled={saving || deleting || !isResolved}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Inverter serial</Label>
                  <Input
                    value={formData.inverter_serial_number}
                    onChange={onChange("inverter_serial_number")}
                    disabled={saving || deleting || !isResolved}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Commissioning date</Label>
                  <Input
                    type="date"
                    value={formData.installation_date}
                    onChange={onChange("installation_date")}
                    disabled={saving || deleting || !isResolved}
                  />
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Meter model</Label>
                  <Input
                    value={formData.meter_model}
                    onChange={onChange("meter_model")}
                    disabled={saving || deleting || !isResolved}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Meter serial</Label>
                  <Input
                    value={formData.meter_serial_number}
                    onChange={onChange("meter_serial_number")}
                    disabled={saving || deleting || !isResolved}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Green meter connection date</Label>
                  <Input
                    type="date"
                    value={formData.green_meter_connection_date}
                    onChange={onChange("green_meter_connection_date")}
                    disabled={saving || deleting || !isResolved}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Remarks</Label>
                  <Textarea
                    value={formData.remarks}
                    onChange={onChange("remarks")}
                    disabled={saving || deleting || !isResolved}
                    className="min-h-24 resize-none"
                  />
                </div>
              </div>

              <Separator />

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  variant="outline"
                  onClick={() => navigate(tehsilRoutes.solarSites)}
                  disabled={saving || deleting}
                >
                  <Lock className="size-4" />
                  Back to solar sites
                </Button>

                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 border-rose-200 text-rose-700 hover:bg-rose-50"
                    onClick={() => void remove()}
                    disabled={saving || deleting || !isResolved}
                    title={
                      monthlyLogCount > 0
                        ? "Deletion blocked: monthly logs exist"
                        : "Delete this solar site"
                    }
                  >
                    {deleting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                    Delete
                  </Button>

                  <Button
                    onClick={() => void save()}
                    disabled={saving || deleting || !isResolved || !canSave}
                    className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {saving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    Save changes
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-base">Editable fields</CardTitle>
              <CardDescription>Assets and metering</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-11 w-full" />
                  </div>
                ))}
              </div>
              <Separator />
              <div className="grid gap-4 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-11 w-full" />
                  </div>
                ))}
              </div>
              <Separator />
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-10 w-40" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </motion.div>
  );
}

