import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Lock,
  Loader2,
  Save,
  ArrowLeft,
  Gauge,
  Info,
  Upload,
  FileText,
  BadgeCheck,
} from "lucide-react";

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
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../../../components/ui/alert";
import { Badge } from "../../../../components/ui/badge";
import { Skeleton } from "../../../../components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../../components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table";
import { tehsilRoutes } from "../../../../constants/routes";
import { getApiErrorMessage } from "../../../../lib/api-error";
import {
  getWaterSystems,
  getWaterSystem,
  updateWaterSystem,
  getWaterSystemCalibrationCertificate,
  putWaterSystemCalibrationCertificate,
  uploadImage,
} from "../../../../services/tehsilManagerOperatorService";
import type {
  SystemMeter,
  WaterSystemCalibrationCertificate,
  WaterSystemRow,
} from "../../../../types/api";
import { formatPakistanDate, nowIsoTimestamp } from "../../../../utils/pakistanTime";

type ToastType = "success" | "error";
type MeterUpdateMode = "update_current" | "switch_new";

export default function WaterSystemEditPage() {
  const navigate = useNavigate();
  const { waterSystemKey } = useParams();
  const key = String(waterSystemKey || "").trim();

  const [toast, setToast] = useState<{ message: string; type: ToastType }>({
    message: "",
    type: "success",
  });
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [saving, setSaving] = useState(false);
  const [system, setSystem] = useState<WaterSystemRow | null>(null);
  const [systemId, setSystemId] = useState<string>("");
  const [detailsLoaded, setDetailsLoaded] = useState(false);
  const [meterHistory, setMeterHistory] = useState<SystemMeter[]>([]);
  const [meterUpdateMode, setMeterUpdateMode] =
    useState<MeterUpdateMode>("update_current");
  const [certs, setCerts] = useState<WaterSystemCalibrationCertificate[]>([]);
  const [certLoading, setCertLoading] = useState(false);
  const [certSaving, setCertSaving] = useState(false);
  const [certExpiry, setCertExpiry] = useState<string>("");
  const [certFile, setCertFile] = useState<File | null>(null);

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

  const fmtDate = formatPakistanDate;

  const [formData, setFormData] = useState({
    latitude: "",
    longitude: "",
    pump_model: "",
    pump_serial_number: "",
    start_of_operation: "",
    depth_of_water_intake: "",
    height_to_ohr: "",
    pump_flow_rate: "",
    bulk_meter_installed: true,
    ohr_tank_capacity: "",
    ohr_fill_required: "",
    pump_capacity: "",
    pump_head: "",
    pump_horse_power: "",
    time_to_fill: "",
    meter_model: "",
    meter_serial_number: "",
    meter_accuracy_class: "",
    installation_date: "",
  });

  const lastLoadedKey = useRef<string>("");

  const isResolved = Boolean(systemId);
  const showShimmers = loadingInitial || (Boolean(key) && !isResolved);

  const RequiredMark = () => (
    <span className="ml-1 text-xs font-semibold text-destructive">*</span>
  );

  const load = async () => {
    if (!key) return;
    if (lastLoadedKey.current === key) return;
    lastLoadedKey.current = key;

    setLoadingInitial(true);
    setDetailsLoaded(false);
    try {
      // Resolve UID (route param) → system id in-scope
      const list = await getWaterSystems();
      const systems = Array.isArray(list) ? (list as WaterSystemRow[]) : [];
      const match = systems.find(
        (s) =>
          String(s.unique_identifier || "").toLowerCase() === key.toLowerCase(),
      );

      if (!match) {
        setToast({
          message:
            "Water system UID not found in your scope (edit uses UID in the URL).",
          type: "error",
        });
        return;
      }

      setSystem(match);
      setSystemId(match.id);

      // Load authoritative details by id
      const detail = (await getWaterSystem(
        match.id,
      )) as Partial<WaterSystemRow>;
      const activeMeter = detail.current_meter ?? null;
      setMeterHistory(Array.isArray(detail.meters) ? detail.meters : []);

      setFormData({
        latitude: detail.latitude != null ? String(detail.latitude) : "",
        longitude: detail.longitude != null ? String(detail.longitude) : "",
        pump_model: String(detail.pump_model ?? ""),
        pump_serial_number: String(detail.pump_serial_number ?? ""),
        start_of_operation: String(detail.start_of_operation ?? ""),
        depth_of_water_intake: String(detail.depth_of_water_intake ?? ""),
        height_to_ohr: String(detail.height_to_ohr ?? ""),
        pump_flow_rate: String(detail.pump_flow_rate ?? ""),
        bulk_meter_installed: Boolean(detail.bulk_meter_installed),
        ohr_tank_capacity: String(detail.ohr_tank_capacity ?? ""),
        ohr_fill_required: String(detail.ohr_fill_required ?? ""),
        pump_capacity: String(detail.pump_capacity ?? ""),
        pump_head: String(detail.pump_head ?? ""),
        pump_horse_power: String(detail.pump_horse_power ?? ""),
        time_to_fill: String(detail.time_to_fill ?? ""),
        meter_model: String(
          activeMeter?.meter_model ?? detail.meter_model ?? "",
        ),
        meter_serial_number: String(
          activeMeter?.meter_serial_number ?? detail.meter_serial_number ?? "",
        ),
        meter_accuracy_class: String(
          activeMeter?.meter_accuracy_class ??
            detail.meter_accuracy_class ??
            "",
        ),
        installation_date: String(
          activeMeter?.installation_date ?? detail.installation_date ?? "",
        ),
      });

      setCertLoading(true);
      try {
        const certRes = (await getWaterSystemCalibrationCertificate(
          match.id,
        )) as WaterSystemCalibrationCertificate[];
        setCerts(Array.isArray(certRes) ? certRes : []);
        setCertExpiry("");
      } catch {
        // Certificate is optional; keep UI usable even if this fetch fails.
      } finally {
        setCertLoading(false);
      }

      setDetailsLoaded(true);
    } catch (e: unknown) {
      setToast({
        message: getApiErrorMessage(e, "Failed to load water system"),
        type: "error",
      });
    } finally {
      setLoadingInitial(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const canSave = useMemo(() => {
    if (!isResolved) return false;
    const baseOk =
      formData.pump_model.trim() &&
      formData.pump_flow_rate.trim() &&
      formData.pump_horse_power.trim() &&
      formData.start_of_operation.trim();
    if (!baseOk) return false;
    if (formData.bulk_meter_installed) {
      return (
        formData.installation_date.trim() &&
        formData.meter_model.trim() &&
        formData.meter_serial_number.trim() &&
        formData.meter_accuracy_class.trim()
      );
    }
    return (
      formData.ohr_tank_capacity.trim() &&
      formData.ohr_fill_required.trim() &&
      formData.pump_capacity.trim() &&
      formData.pump_head.trim() &&
      formData.time_to_fill.trim()
    );
  }, [formData, isResolved]);

  const save = async () => {
    if (!isResolved) return;
    setSaving(true);
    try {
      const {
        meter_model,
        meter_serial_number,
        meter_accuracy_class,
        installation_date,
        ...rest
      } = formData;
      await updateWaterSystem(systemId, {
        tehsil: system?.tehsil,
        village: system?.village,
        settlement: system?.settlement ?? "",
        ...rest,
        current_meter: {
          meter_type: "tubewell",
          meter_model,
          meter_serial_number,
          meter_accuracy_class,
          installation_date,
          update_mode: meterUpdateMode,
        },
        status: "submitted",
      });
      setToast({ message: "✅ Water system updated!", type: "success" });
      setTimeout(() => navigate(tehsilRoutes.waterSystems), 900);
    } catch (e: unknown) {
      setToast({
        message: getApiErrorMessage(e, "Update failed"),
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveCertificate = async () => {
    if (!isResolved) return;
    if (!certFile) {
      setToast({
        message: "Please choose a certificate file to upload.",
        type: "error",
      });
      return;
    }
    if (!certExpiry.trim()) {
      setToast({
        message: "Please select an expiry date.",
        type: "error",
      });
      return;
    }
    setCertSaving(true);
    try {
      const up = await uploadImage(certFile, "water_calibration", null);
      const fileUrl = String(up.image_url || up.path || "").trim();
      if (!fileUrl) {
        throw new Error("Upload failed");
      }
      const saved = (await putWaterSystemCalibrationCertificate(systemId, {
        file_url: fileUrl,
        expiry_date: certExpiry,
      })) as Partial<WaterSystemCalibrationCertificate>;
      setCerts((prev) => [
        {
          id: String(saved.id ?? ""),
          water_system_id: systemId,
          file_url: fileUrl,
          uploaded_at: String(saved.uploaded_at ?? nowIsoTimestamp()),
          expiry_date: certExpiry,
          is_active: true,
          created_at: String(saved.created_at ?? null),
          updated_at: String(saved.updated_at ?? null),
        },
        ...prev.map((c) => ({ ...c, is_active: false })),
      ]);
      setCertFile(null);
      setCertExpiry("");
      setToast({
        message: "✅ Calibration certificate saved!",
        type: "success",
      });
    } catch (e: unknown) {
      setToast({
        message: getApiErrorMessage(
          e,
          "Failed to save calibration certificate",
        ),
        type: "error",
      });
    } finally {
      setCertSaving(false);
    }
  };

  const onChange =
    (field: keyof typeof formData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/70 p-4 md:p-6"
    >
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: "", type: "success" })}
      />

      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                Edit water system
              </h1>
              <Badge variant="outline" className="border-slate-300 bg-white">
                Edit mode
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Identity and location are locked. Only editable fields are shown
              below.
            </p>
          </div>
        </div>

        {!key ? (
          <Alert className="border-amber-200 bg-amber-50 text-amber-950">
            <AlertTitle>Missing system key</AlertTitle>
            <AlertDescription>
              Open this page from Water systems list.
            </AlertDescription>
          </Alert>
        ) : null}

        <Card className="mb-6 border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">System</CardTitle>
            <CardDescription>Read-only identity & location</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {showShimmers ? (
              <>
                {Array.from({ length: 5 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border bg-background p-3"
                  >
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="mt-2 h-4 w-full" />
                  </div>
                ))}
              </>
            ) : (
              <>
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-[11px] text-muted-foreground">System ID</p>
                  <p className="mt-1 font-mono text-xs">{systemId}</p>
                </div>
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-[11px] text-muted-foreground">
                    Water system key
                  </p>
                  <p className="mt-1 font-mono text-xs">{key}</p>
                </div>
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-[11px] text-muted-foreground">Tehsil</p>
                  <p className="mt-1 font-medium">{system?.tehsil || "—"}</p>
                </div>
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-[11px] text-muted-foreground">Village</p>
                  <p className="mt-1 font-medium">{system?.village || "—"}</p>
                </div>
                <div className="rounded-lg border bg-background p-3 md:col-span-2">
                  <p className="text-[11px] text-muted-foreground">
                    Settlement
                  </p>
                  <p className="mt-1 font-medium">
                    {system?.settlement || "—"}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {!showShimmers && detailsLoaded ? (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Editable fields</CardTitle>
              <CardDescription>
                Coordinates, equipment, and metering
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-xl border border-slate-200/80 bg-white/80 p-4">
                <div className="mb-4 flex items-center gap-2">
                  <Gauge className="size-4 text-slate-600" />
                  <p className="text-sm font-semibold text-slate-800">
                    System Configuration
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Latitude (Optional)</Label>
                    <Input
                      type="number"
                      value={formData.latitude}
                      onChange={onChange("latitude")}
                      disabled={saving || !isResolved}
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
                      disabled={saving || !isResolved}
                      inputMode="decimal"
                      placeholder="e.g. 73.25291"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Pump model
                      <RequiredMark />
                    </Label>
                    <Input
                      value={formData.pump_model}
                      onChange={onChange("pump_model")}
                      disabled={saving || !isResolved}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Pump serial number </Label>
                    <Input
                      value={formData.pump_serial_number}
                      onChange={onChange("pump_serial_number")}
                      disabled={saving || !isResolved}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="leading-none">Column Height (m)</Label>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <button
                              type="button"
                              className="inline-flex items-center text-muted-foreground hover:text-foreground"
                              aria-label="What is Column Height?"
                            >
                              <Info className="size-4" />
                            </button>
                          }
                        />
                        <TooltipContent>
                          Vertical distance/height of the water column (formerly
                          “Intake depth”).
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input
                      type="number"
                      value={formData.depth_of_water_intake}
                      onChange={onChange("depth_of_water_intake")}
                      disabled={saving || !isResolved}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Flow rate (m³/h)
                      <RequiredMark />
                    </Label>
                    <Input
                      type="number"
                      value={formData.pump_flow_rate}
                      onChange={onChange("pump_flow_rate")}
                      disabled={saving || !isResolved}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Pump horse power (HP)
                      <RequiredMark />
                    </Label>
                    <Input
                      type="number"
                      value={formData.pump_horse_power}
                      onChange={onChange("pump_horse_power")}
                      disabled={saving || !isResolved}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Operation start
                      <RequiredMark />
                    </Label>
                    <Input
                      type="date"
                      value={formData.start_of_operation}
                      onChange={onChange("start_of_operation")}
                      disabled={saving || !isResolved}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div
                id="calibration-certificates-section"
                className="space-y-3 rounded-xl border border-border/70 bg-card p-4"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
                      <BadgeCheck className="size-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold leading-none">
                          Calibration certificates
                        </p>
                        <Badge variant="outline" className="text-[11px]">
                          one active
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Bulk-meter only: upload a certificate (PDF/image) and
                        set its expiry date. Systems without a bulk meter do not
                        require a calibration certificate. Uploading a new one
                        automatically marks the previous as inactive.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 md:justify-end">
                    {certLoading ? (
                      <span className="text-xs text-muted-foreground">
                        Loading…
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {certs.length} total
                      </span>
                    )}
                  </div>
                </div>

                {certs.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border bg-background/60">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>File</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Uploaded</TableHead>
                          <TableHead>Expiry</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {certs.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell className="max-w-[360px]">
                              <div className="flex items-center gap-2">
                                <FileText className="size-4 text-muted-foreground" />
                                <span className="truncate font-medium">
                                  {fileNameFromUrl(c.file_url)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {c.is_active ? (
                                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                                  Active
                                </Badge>
                              ) : (
                                <Badge variant="outline">Inactive</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {fmtDate(c.uploaded_at)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {fmtDate(c.expiry_date)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  window.open(c.file_url, "_blank")
                                }
                              >
                                <FileText className="size-4" />
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed bg-background/50 p-6 text-center text-sm text-muted-foreground">
                    No certificates uploaded yet. This is only required for
                    bulk-meter systems.
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-[1fr_1.3fr_auto] md:items-end">
                  <div className="space-y-2">
                    <Label>
                      Expiry date
                      <RequiredMark />
                    </Label>
                    <Input
                      type="date"
                      value={certExpiry}
                      onChange={(e) => setCertExpiry(e.target.value)}
                      disabled={saving || !isResolved || certSaving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Certificate file</Label>
                    <Input
                      type="file"
                      accept=".pdf,image/*"
                      onChange={(e) => setCertFile(e.target.files?.[0] ?? null)}
                      disabled={saving || !isResolved || certSaving}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={() => void saveCertificate()}
                      disabled={saving || !isResolved || certSaving}
                      className="gap-2"
                    >
                      {certSaving ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Upload className="size-4" />
                      )}
                      Save
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              <Card className="border-slate-200 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">
                    Metering Information
                  </CardTitle>
                  <CardDescription>
                    Manage the active meter, switch to a new meter, and review
                    meter history.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-full bg-white p-1.5 text-primary shadow-sm">
                        <Info className="size-4" aria-hidden />
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-foreground">
                          Meter update guide
                        </p>
                        <div className="space-y-1.5 text-sm text-muted-foreground">
                          <p>
                            <span className="font-medium text-foreground">
                              1. Set bulk meter status:
                            </span>{" "}
                            Meter model, serial, accuracy class, and
                            installation date apply only when{" "}
                            <span className="font-medium text-foreground">
                              Bulk meter installed?
                            </span>{" "}
                            is{" "}
                            <span className="font-medium text-foreground">
                              Yes
                            </span>
                            . If there is no bulk meter, select{" "}
                            <span className="font-medium text-foreground">
                              No
                            </span>{" "}
                            and complete the OHR and pump fields instead.
                          </p>
                          <p>
                            <span className="font-medium text-foreground">
                              2. Update current:
                            </span>{" "}
                            Use this to correct details for the currently active
                            bulk meter.
                          </p>
                          <p>
                            <span className="font-medium text-foreground">
                              3. Switch new:
                            </span>{" "}
                            Use this when a replacement bulk meter is installed.
                            Previous meters remain in{" "}
                            <span className="font-medium text-foreground">
                              Meter history
                            </span>{" "}
                            as inactive.
                          </p>
                          <p>
                            <span className="font-medium text-foreground">
                              4. Save:
                            </span>{" "}
                            Click{" "}
                            <span className="font-medium text-foreground">
                              Save
                            </span>{" "}
                            at the bottom of the page to apply changes.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <Label className="text-sm font-semibold">
                          Meter update mode
                        </Label>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Update current meter edits the active record. Switch
                          to new meter creates a new history entry and keeps old
                          one inactive.
                        </p>
                      </div>
                      <div className="inline-flex w-fit overflow-hidden rounded-xl border bg-white p-1">
                        <Button
                          type="button"
                          variant={
                            meterUpdateMode === "update_current"
                              ? "default"
                              : "ghost"
                          }
                          className="rounded-lg px-4"
                          onClick={() => setMeterUpdateMode("update_current")}
                          disabled={saving || !isResolved}
                        >
                          Update current
                        </Button>
                        <Button
                          type="button"
                          variant={
                            meterUpdateMode === "switch_new"
                              ? "default"
                              : "ghost"
                          }
                          className="rounded-lg px-4"
                          onClick={() => setMeterUpdateMode("switch_new")}
                          disabled={saving || !isResolved}
                        >
                          Switch new
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <Label className="text-sm font-semibold">
                          Bulk meter installed? <RequiredMark />
                        </Label>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Choose <span className="font-semibold">Yes</span> if a
                          bulk meter is installed; otherwise choose{" "}
                          <span className="font-semibold">No</span>.
                        </p>
                      </div>
                      <div className="inline-flex w-fit overflow-hidden rounded-xl border bg-white p-1">
                        <Button
                          type="button"
                          variant={
                            formData.bulk_meter_installed ? "default" : "ghost"
                          }
                          className="rounded-lg px-4"
                          onClick={() =>
                            setFormData((p) => ({
                              ...p,
                              bulk_meter_installed: true,
                            }))
                          }
                          disabled={saving || !isResolved}
                        >
                          Yes
                        </Button>
                        <Button
                          type="button"
                          variant={
                            !formData.bulk_meter_installed ? "default" : "ghost"
                          }
                          className="rounded-lg px-4"
                          onClick={() =>
                            setFormData((p) => ({
                              ...p,
                              bulk_meter_installed: false,
                            }))
                          }
                          disabled={saving || !isResolved}
                        >
                          No
                        </Button>
                      </div>
                    </div>
                  </div>

                  {!formData.bulk_meter_installed ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>
                          Tank capacity (m3)
                          <RequiredMark />
                        </Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={formData.ohr_tank_capacity}
                          onChange={onChange("ohr_tank_capacity")}
                          disabled={saving || !isResolved}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>
                          Design time to fill tank (minutes)
                          <RequiredMark />
                        </Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={formData.ohr_fill_required}
                          onChange={onChange("ohr_fill_required")}
                          disabled={saving || !isResolved}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>
                          Pump capacity
                          <RequiredMark />
                        </Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={formData.pump_capacity}
                          onChange={onChange("pump_capacity")}
                          disabled={saving || !isResolved}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>
                          Pump head (m)
                          <RequiredMark />
                        </Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={formData.pump_head}
                          onChange={onChange("pump_head")}
                          disabled={saving || !isResolved}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>
                          Actual time to fill the tank (minutes)
                          <RequiredMark />
                        </Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={formData.time_to_fill}
                          onChange={onChange("time_to_fill")}
                          disabled={saving || !isResolved}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>
                          Installation date
                          <RequiredMark />
                        </Label>
                        <Input
                          type="date"
                          value={formData.installation_date}
                          onChange={onChange("installation_date")}
                          disabled={saving || !isResolved}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>
                          Meter model
                          <RequiredMark />
                        </Label>
                        <Input
                          value={formData.meter_model}
                          onChange={onChange("meter_model")}
                          disabled={saving || !isResolved}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>
                          Meter serial number
                          <RequiredMark />
                        </Label>
                        <Input
                          value={formData.meter_serial_number}
                          onChange={onChange("meter_serial_number")}
                          disabled={saving || !isResolved}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>
                          Accuracy class
                          <RequiredMark />
                        </Label>
                        <Input
                          value={formData.meter_accuracy_class}
                          onChange={onChange("meter_accuracy_class")}
                          disabled={saving || !isResolved}
                        />
                      </div>
                    </div>
                  )}

                  <Card className="border-dashed bg-white">
                    <CardHeader>
                      <CardTitle className="text-sm">Meter history</CardTitle>
                      <CardDescription>
                        Changing meter details creates a new active meter entry
                        and keeps old meter records as inactive.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {meterHistory.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No meter history available.
                        </p>
                      ) : (
                        meterHistory.map((meter) => (
                          <div
                            key={meter.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm"
                          >
                            <div className="min-w-0">
                              <p className="font-medium">
                                {meter.meter_model || "Unknown model"} ·{" "}
                                {meter.meter_serial_number || "No serial"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Accuracy: {meter.meter_accuracy_class || "—"} ·
                                Installed: {meter.installation_date || "—"}
                              </p>
                            </div>
                            <Badge
                              variant={meter.is_active ? "default" : "outline"}
                            >
                              {meter.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </CardContent>
              </Card>

              <Separator />

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  variant="outline"
                  onClick={() => navigate(tehsilRoutes.waterSystems)}
                  disabled={saving}
                >
                  <Lock className="size-4" />
                  Back to water systems
                </Button>
                <Button
                  onClick={() => void save()}
                  disabled={saving || !isResolved || !canSave}
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
            </CardContent>
          </Card>
        ) : showShimmers ? (
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-base">Editable fields</CardTitle>
              <CardDescription>Equipment and metering</CardDescription>
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
        ) : null}
      </div>
    </motion.div>
  );
}
