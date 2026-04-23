import { useState, useMemo, useEffect, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { tehsilRoutes } from "../../../constants/routes";
import { useTehsilManagerOperatorApi } from "../../../hooks";
import { useAuth } from "../../../contexts/AuthContext";
import { motion } from "framer-motion";
import {
  Droplets,
  Loader2,
  Send,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import Toast from "../../../components/Toast";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { FormStepper } from "../../../components/ui/form-stepper";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Separator } from "../../../components/ui/separator";
import { Badge } from "../../../components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "../../../components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { getApiErrorMessage } from "../../../lib/api-error";
import {
  TEHSIL_OPTIONS,
  LOCATION_DATA,
  SETTLEMENT_DATA,
} from "../../../utils/locationData";

/** Map API / profile tehsil string to canonical `TEHSIL_OPTIONS` entry. */
function canonicalTehsil(raw: string): string | null {
  const t = raw.trim().toUpperCase();
  return (TEHSIL_OPTIONS as readonly string[]).find((o) => o === t) ?? null;
}

type ToastType = "success" | "error";
type SubmissionStatus = "submitted";
const WaterSystemForm = () => {
  const isEditMode = false;
  const { user } = useAuth();
  const { createWaterSystem, getWaterSystemConfig } = useTehsilManagerOperatorApi();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType }>({
    message: "",
    type: "success",
  });
  const [activeStep, setActiveStep] = useState(1); // 1: Location, 2: Equipment, 3: Metering

  const tehsilSelectOptions = useMemo(() => {
    const fromUser = (user?.tehsils ?? [])
      .map(canonicalTehsil)
      .filter((x): x is string => Boolean(x));
    const unique = [...new Set(fromUser)];
    if (unique.length > 0) return unique;
    return [...TEHSIL_OPTIONS];
  }, [user?.tehsils]);

  const hasResolvedProfileTehsils = useMemo(() => {
    const fromUser = (user?.tehsils ?? [])
      .map(canonicalTehsil)
      .filter((x): x is string => Boolean(x));
    return new Set(fromUser).size > 0;
  }, [user?.tehsils]);

  const tehsilSelectLocked =
    hasResolvedProfileTehsils && tehsilSelectOptions.length === 1;

  const [formData, setFormData] = useState({
    tehsil: "",
    village: "",
    settlement: "",
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

  const [systemExists, setSystemExists] = useState(false);

  useEffect(() => {
    if (!hasResolvedProfileTehsils || tehsilSelectOptions.length === 0) return;
    setFormData((prev) => {
      if (prev.tehsil) return prev;
      const next = tehsilSelectOptions[0] ?? "";
      if (!next) return prev;
      return { ...prev, tehsil: next, village: "", settlement: "" };
    });
  }, [hasResolvedProfileTehsils, tehsilSelectOptions]);

  const handleFieldChange = async (name: string, value: string) => {
    let newTehsil = formData.tehsil;
    let newVillage = formData.village;
    let newSettlement = formData.settlement;

    if (name === "tehsil") {
      newTehsil = value;
      newVillage = "";
      newSettlement = "";
    } else if (name === "village") {
      newVillage = value;
      newSettlement = "";
    } else if (name === "settlement") {
      newSettlement = value;
    }

    setFormData({
      ...formData,
      [name]: value,
      ...(name === "tehsil" && { village: "", settlement: "" }),
      ...(name === "village" && { settlement: "" }),
    });

    if (
      (name === "tehsil" || name === "village" || name === "settlement") &&
      newTehsil &&
      newVillage
    ) {
      try {
        const result = await getWaterSystemConfig(
          newTehsil,
          newVillage,
          newSettlement || "",
        );
        if (!isEditMode && result.exists && result.config) {
          setToast({
            message: "⚠️ This location is already registered.",
            type: "error",
          });
          setSystemExists(true);
        } else {
          setSystemExists(false);
        }
      } catch (error: unknown) {
        setSystemExists(false);
        setToast({
          message: getApiErrorMessage(error, "Failed to validate location"),
          type: "error",
        });
      }
    }
  };

  const handleChange = async (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    await handleFieldChange(name, value);
  };

  const handleSubmit = async (status: SubmissionStatus = "submitted") => {
    setLoading(true);
    try {
      await createWaterSystem({ ...formData, status });
      setToast({
        message: "✅ Registration complete!",
        type: "success",
      });
      if (status === "submitted") {
        setTimeout(() => navigate(tehsilRoutes.dashboard), 1200);
      }
    } catch (err: unknown) {
      setToast({
        message: getApiErrorMessage(err, "Submission failed"),
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    {
      id: 1,
      label: "Location",
      hint: "Choose tehsil, village, and settlement",
    },
    { id: 2, label: "Equipment", hint: "Enter pump and operation details" },
    {
      id: 3,
      label: "Metering",
      hint: "Set metering and calibration information",
    },
  ];

  const REQUIRED_FIELDS_BY_STEP: Record<
    number,
    Array<keyof typeof formData>
  > = {
    1: ["tehsil", "village"],
    2: ["pump_model", "pump_serial_number", "pump_flow_rate", "start_of_operation"],
    3: ["bulk_meter_installed"],
  };

  const FIELD_LABELS: Record<string, string> = {
    tehsil: "Tehsil",
    village: "Village",
    settlement: "Settlement",
    latitude: "Latitude",
    longitude: "Longitude",
    pump_model: "Pump Model",
    pump_serial_number: "Pump Serial Number",
    start_of_operation: "Operation Start",
    depth_of_water_intake: "Intake Depth",
    height_to_ohr: "Height to OHR",
    pump_flow_rate: "Flow Rate",
    bulk_meter_installed: "Bulk meter installed",
    ohr_tank_capacity: "Tank capacity (OHR)",
    ohr_fill_required: "Required to fill tank (OHR)",
    pump_capacity: "Pump capacity",
    pump_head: "Pump head",
    pump_horse_power: "Pump horse power (kVA/W)",
    time_to_fill: "Time to fill",
    meter_model: "Meter Model",
    meter_serial_number: "Meter Serial Number",
    meter_accuracy_class: "Accuracy Class",
    calibration_requirement: "Calibration Notes",
    installation_date: "Installation Date",
  };

  const validateStep = (stepToValidate: number) => {
    const requiredFields = REQUIRED_FIELDS_BY_STEP[stepToValidate] ?? [];
    const conditionalRequired =
      stepToValidate === 3
        ? formData.bulk_meter_installed
          ? ([
              "meter_model",
              "meter_serial_number",
              "meter_accuracy_class",
              "calibration_requirement",
              "installation_date",
            ] as Array<keyof typeof formData>)
          : ([
              "ohr_tank_capacity",
              "ohr_fill_required",
              "pump_capacity",
              "pump_head",
              "pump_horse_power",
              "time_to_fill",
            ] as Array<keyof typeof formData>)
        : [];
    const allRequired = [...requiredFields, ...conditionalRequired];
    const missing = allRequired.filter((field) => {
      const v = formData[field];
      if (typeof v === "boolean") return false;
      return !String(v).trim();
    });

    if (missing.length === 0) return true;

    setToast({
      message: `Complete required fields: ${missing
        .map((field) => FIELD_LABELS[field])
        .join(", ")}`,
      type: "error",
    });
    return false;
  };

  const attemptStepChange = (targetStep: number) => {
    if (targetStep <= activeStep) {
      setActiveStep(targetStep);
      return;
    }

    for (
      let stepNumber = activeStep;
      stepNumber < targetStep;
      stepNumber += 1
    ) {
      if (!validateStep(stepNumber)) return;
    }

    setActiveStep(targetStep);
  };

  const stepMeta = steps.find((s) => s.id === activeStep) ?? steps[0];

  const RequiredMark = () => (
    <span className="ml-1 text-xs font-semibold text-destructive">*</span>
  );

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
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="size-4" />
            </Button>
            <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-sm">
              <Droplets className="size-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                  {isEditMode ? "Edit water system" : "Register water system"}
                </h1>
                <Badge variant="outline">
                  {isEditMode ? "Edit mode" : "New registration"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {isEditMode
                  ? "Update equipment and metering details for the selected location."
                  : "Register a new water system for monitoring and reporting."}
              </p>
            </div>
          </div>
        </div>

        <Card className="mb-6 border-slate-200">
          <CardContent className="pt-6">
            <FormStepper
              steps={steps}
              currentStep={activeStep}
              onStepClick={attemptStepChange}
            />
          </CardContent>
        </Card>

        {systemExists ? (
          <Alert className="mb-6 border-amber-200 bg-amber-50 text-amber-950">
            <AlertTitle>Location already registered</AlertTitle>
            <AlertDescription>
              This tehsil/village/settlement already has a registered water system.
              Choose a different location.
            </AlertDescription>
          </Alert>
        ) : null}

        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-base">{stepMeta?.label}</CardTitle>
              <CardDescription>
                {stepMeta?.hint}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
            {activeStep === 1 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>
                    Tehsil
                    {tehsilSelectLocked ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        (your tehsil)
                      </span>
                    ) : null}
                    <RequiredMark />
                  </Label>
                  <Select
                    value={formData.tehsil || "__empty__"}
                    disabled={tehsilSelectLocked || isEditMode}
                    onValueChange={(v) => {
                      if (!v) return;
                      handleFieldChange("tehsil", v === "__empty__" ? "" : v);
                    }}
                  >
                    <SelectTrigger className="h-11 w-full">
                      <SelectValue placeholder="Select Tehsil" />
                    </SelectTrigger>
                    <SelectContent>
                      {!tehsilSelectLocked ? (
                        <SelectItem value="__empty__">Select Tehsil</SelectItem>
                      ) : null}
                      {tehsilSelectOptions.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Your access is scoped by assigned tehsils.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>
                    Village
                    <RequiredMark />
                  </Label>
                  <Select
                    value={formData.village || "__empty__"}
                    onValueChange={(v) => {
                      if (!v) return;
                      handleFieldChange("village", v === "__empty__" ? "" : v);
                    }}
                  >
                    <SelectTrigger
                      className="h-11 w-full"
                      disabled={!formData.tehsil || isEditMode}
                    >
                      <SelectValue placeholder="Select Village" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__empty__">Select Village</SelectItem>
                      {(LOCATION_DATA[formData.tehsil] || []).map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Villages are filtered by selected tehsil.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Settlement (Optional)</Label>
                  <Select
                    value={formData.settlement || "__empty__"}
                    onValueChange={(v) => {
                      if (!v) return;
                      handleFieldChange(
                        "settlement",
                        v === "__empty__" ? "" : v,
                      );
                    }}
                  >
                    <SelectTrigger
                      className="h-11 w-full"
                      disabled={!formData.village || isEditMode}
                    >
                      <SelectValue placeholder="Select Settlement" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__empty__">
                        Select Settlement (Optional)
                      </SelectItem>
                      {(SETTLEMENT_DATA[formData.village] || []).map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Leave blank if the site has no settlement mapping.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Latitude (Optional)</Label>
                  <Input
                    type="number"
                    name="latitude"
                    value={formData.latitude}
                    onChange={handleChange}
                    className="h-11"
                    placeholder="e.g. 29.99812"
                    disabled={loading}
                    inputMode="decimal"
                  />
                  <p className="text-xs text-muted-foreground">
                    GPS coordinate for mapping and analytics.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Longitude (Optional)</Label>
                  <Input
                    type="number"
                    name="longitude"
                    value={formData.longitude}
                    onChange={handleChange}
                    className="h-11"
                    placeholder="e.g. 73.25291"
                    disabled={loading}
                    inputMode="decimal"
                  />
                  <p className="text-xs text-muted-foreground">
                    GPS coordinate for mapping and analytics.
                  </p>
                </div>
              </div>
            ) : null}

            {activeStep === 2 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>
                    Pump model
                    <RequiredMark />
                  </Label>
                  <Input
                    name="pump_model"
                    value={formData.pump_model}
                    onChange={handleChange}
                    className="h-11"
                    placeholder="e.g. Grundfos CRI"
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    Pump serial number
                    <RequiredMark />
                  </Label>
                  <Input
                    name="pump_serial_number"
                    value={formData.pump_serial_number}
                    onChange={handleChange}
                    className="h-11"
                    placeholder="SN-XXXX"
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Intake Depth (m)</Label>
                  <Input
                    type="number"
                    name="depth_of_water_intake"
                    value={formData.depth_of_water_intake}
                    onChange={handleChange}
                    className="h-11"
                    placeholder="0.0"
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    Flow rate (m³/h)
                    <RequiredMark />
                  </Label>
                  <Input
                    type="number"
                    name="pump_flow_rate"
                    value={formData.pump_flow_rate}
                    onChange={handleChange}
                    className="h-11"
                    placeholder="0.0"
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    Operation start
                    <RequiredMark />
                  </Label>
                  <Input
                    type="date"
                    name="start_of_operation"
                    value={formData.start_of_operation}
                    onChange={handleChange}
                    className="h-11"
                    disabled={loading}
                  />
                </div>
              </div>
            ) : null}

            {activeStep === 3 ? (
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
                        disabled={loading}
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
                        disabled={loading}
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
                        Tank capacity (OHR) <RequiredMark />
                      </Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        name="ohr_tank_capacity"
                        value={formData.ohr_tank_capacity}
                        onChange={handleChange}
                        className="h-11"
                        placeholder="e.g. 10"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>
                        Required to fill tank (OHR) <RequiredMark />
                      </Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        name="ohr_fill_required"
                        value={formData.ohr_fill_required}
                        onChange={handleChange}
                        className="h-11"
                        placeholder="e.g. 10"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>
                        Pump capacity <RequiredMark />
                      </Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        name="pump_capacity"
                        value={formData.pump_capacity}
                        onChange={handleChange}
                        className="h-11"
                        placeholder="e.g. 5"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>
                        Pump head <RequiredMark />
                      </Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        name="pump_head"
                        value={formData.pump_head}
                        onChange={handleChange}
                        className="h-11"
                        placeholder="e.g. 40"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>
                        Pump horse power (kVA/W) <RequiredMark />
                      </Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        name="pump_horse_power"
                        value={formData.pump_horse_power}
                        onChange={handleChange}
                        className="h-11"
                        placeholder="e.g. 7.5"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>
                        Time to fill (minutes) <RequiredMark />
                      </Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        name="time_to_fill"
                        value={formData.time_to_fill}
                        onChange={handleChange}
                        className="h-11"
                        placeholder="e.g. 60"
                        disabled={loading}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>
                          Installation date <RequiredMark />
                        </Label>
                        <Input
                          type="date"
                          name="installation_date"
                          value={formData.installation_date}
                          onChange={handleChange}
                          className="h-11"
                          disabled={loading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>
                          Meter model <RequiredMark />
                        </Label>
                        <Input
                          name="meter_model"
                          value={formData.meter_model}
                          onChange={handleChange}
                          className="h-11"
                          disabled={loading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>
                          Meter serial number <RequiredMark />
                        </Label>
                        <Input
                          name="meter_serial_number"
                          value={formData.meter_serial_number}
                          onChange={handleChange}
                          className="h-11"
                          disabled={loading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>
                          Accuracy class <RequiredMark />
                        </Label>
                        <Input
                          name="meter_accuracy_class"
                          value={formData.meter_accuracy_class}
                          onChange={handleChange}
                          placeholder="e.g. Class B"
                          className="h-11"
                          disabled={loading}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>
                        Calibration notes <RequiredMark />
                      </Label>
                      <Textarea
                        name="calibration_requirement"
                        value={formData.calibration_requirement}
                        onChange={handleChange}
                        placeholder="Frequency, last calibration, etc."
                        className="min-h-24 resize-none"
                        disabled={loading}
                      />
                    </div>
                  </>
                )}
              </div>
            ) : null}

            <Separator />

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              {activeStep > 1 ? (
                <Button
                  variant="outline"
                  onClick={() => setActiveStep((prev) => prev - 1)}
                >
                  Previous Step
                </Button>
              ) : (
                <div />
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                {activeStep < 3 ? (
                  <Button
                    onClick={() => attemptStepChange(activeStep + 1)}
                    className="gap-2"
                    disabled={loading}
                  >
                    Next Step <ChevronRight className="size-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleSubmit("submitted")}
                    disabled={
                      loading ||
                      systemExists ||
                      !formData.tehsil ||
                      !formData.village
                    }
                    className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {loading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    Complete registration
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
      </div>
    </motion.div>
  );
};

export default WaterSystemForm;
