import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Loader2, Save, ArrowLeft } from "lucide-react";

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
  getWaterSystems,
  getWaterSystem,
  updateWaterSystem,
} from "../../../../services/tehsilManagerOperatorService";
import type { WaterSystemRow } from "../../../../types/api";

type ToastType = "success" | "error";

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
    calibration_requirement: "",
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
        (s) => String(s.unique_identifier || "").toLowerCase() === key.toLowerCase(),
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
      const detail = (await getWaterSystem(match.id)) as Partial<WaterSystemRow>;

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
        meter_model: String(detail.meter_model ?? ""),
        meter_serial_number: String(detail.meter_serial_number ?? ""),
        meter_accuracy_class: String(detail.meter_accuracy_class ?? ""),
        calibration_requirement: String(detail.calibration_requirement ?? ""),
        installation_date: String(detail.installation_date ?? ""),
      });

      setDetailsLoaded(true);
    } catch (e: unknown) {
      setToast({ message: getApiErrorMessage(e, "Failed to load water system"), type: "error" });
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
      formData.pump_serial_number.trim() &&
      formData.pump_flow_rate.trim() &&
      formData.start_of_operation.trim();
    if (!baseOk) return false;
    if (formData.bulk_meter_installed) {
      return (
        formData.installation_date.trim() &&
        formData.meter_model.trim() &&
        formData.meter_serial_number.trim() &&
        formData.meter_accuracy_class.trim() &&
        formData.calibration_requirement.trim()
      );
    }
    return (
      formData.ohr_tank_capacity.trim() &&
      formData.ohr_fill_required.trim() &&
      formData.pump_capacity.trim() &&
      formData.pump_head.trim() &&
      formData.pump_horse_power.trim() &&
      formData.time_to_fill.trim()
    );
  }, [formData, isResolved]);

  const save = async () => {
    if (!isResolved) return;
    setSaving(true);
    try {
      await updateWaterSystem(systemId, {
        tehsil: system?.tehsil,
        village: system?.village,
        settlement: system?.settlement ?? "",
        ...formData,
        status: "submitted",
      });
      setToast({ message: "✅ Water system updated!", type: "success" });
      setTimeout(() => navigate(tehsilRoutes.waterSystems), 900);
    } catch (e: unknown) {
      setToast({ message: getApiErrorMessage(e, "Update failed"), type: "error" });
    } finally {
      setSaving(false);
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
                Edit water system
              </h1>
              <Badge variant="outline">Edit mode</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Identity and location are locked. Only editable fields are shown below.
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

        <Card className="mb-6 border-slate-200">
          <CardHeader>
            <CardTitle className="text-base">System</CardTitle>
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
                  <p className="mt-1 font-mono text-xs">{systemId}</p>
                </div>
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-[11px] text-muted-foreground">Water system key</p>
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
                  <p className="text-[11px] text-muted-foreground">Settlement</p>
                  <p className="mt-1 font-medium">{system?.settlement || "—"}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {!showShimmers && detailsLoaded ? (
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-base">Editable fields</CardTitle>
              <CardDescription>Coordinates, equipment, and metering</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
                  Pump model<RequiredMark />
                </Label>
                <Input
                  value={formData.pump_model}
                  onChange={onChange("pump_model")}
                  disabled={saving || !isResolved}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Pump serial number<RequiredMark />
                </Label>
                <Input
                  value={formData.pump_serial_number}
                  onChange={onChange("pump_serial_number")}
                  disabled={saving || !isResolved}
                />
              </div>
              <div className="space-y-2">
                <Label>Intake depth (m)</Label>
                <Input
                  type="number"
                  value={formData.depth_of_water_intake}
                  onChange={onChange("depth_of_water_intake")}
                  disabled={saving || !isResolved}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Flow rate (m³/h)<RequiredMark />
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
                  Operation start<RequiredMark />
                </Label>
                <Input
                  type="date"
                  value={formData.start_of_operation}
                  onChange={onChange("start_of_operation")}
                  disabled={saving || !isResolved}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="rounded-xl border border-border/70 bg-card p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <Label className="text-sm font-semibold">
                      Bulk meter installed? <RequiredMark />
                    </Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Choose <span className="font-semibold">Yes</span> if a bulk
                      meter is installed; otherwise choose{" "}
                      <span className="font-semibold">No</span>.
                    </p>
                  </div>
                  <div className="inline-flex w-fit overflow-hidden rounded-lg border">
                    <Button
                      type="button"
                      variant={formData.bulk_meter_installed ? "default" : "ghost"}
                      className="rounded-none px-5"
                      onClick={() =>
                        setFormData((p) => ({ ...p, bulk_meter_installed: true }))
                      }
                      disabled={saving || !isResolved}
                    >
                      Yes
                    </Button>
                    <Button
                      type="button"
                      variant={!formData.bulk_meter_installed ? "default" : "ghost"}
                      className="rounded-none px-5"
                      onClick={() =>
                        setFormData((p) => ({ ...p, bulk_meter_installed: false }))
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
                      Tank capacity (OHR)<RequiredMark />
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
                      Required to fill tank (OHR)<RequiredMark />
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
                      Pump capacity<RequiredMark />
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
                      Pump head<RequiredMark />
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
                      Pump horse power (kVA/W)<RequiredMark />
                    </Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={formData.pump_horse_power}
                      onChange={onChange("pump_horse_power")}
                      disabled={saving || !isResolved}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Time to fill (minutes)<RequiredMark />
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
                      Installation date<RequiredMark />
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
                      Meter model<RequiredMark />
                    </Label>
                    <Input
                      value={formData.meter_model}
                      onChange={onChange("meter_model")}
                      disabled={saving || !isResolved}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Meter serial number<RequiredMark />
                    </Label>
                    <Input
                      value={formData.meter_serial_number}
                      onChange={onChange("meter_serial_number")}
                      disabled={saving || !isResolved}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Accuracy class<RequiredMark />
                    </Label>
                    <Input
                      value={formData.meter_accuracy_class}
                      onChange={onChange("meter_accuracy_class")}
                      disabled={saving || !isResolved}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>
                      Calibration notes<RequiredMark />
                    </Label>
                    <Textarea
                      value={formData.calibration_requirement}
                      onChange={onChange("calibration_requirement")}
                      disabled={saving || !isResolved}
                      className="min-h-24 resize-none"
                    />
                  </div>
                </div>
              )}
            </div>

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

