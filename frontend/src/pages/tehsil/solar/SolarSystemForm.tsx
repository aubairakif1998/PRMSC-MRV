import { useState, useMemo, useEffect, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { tehsilRoutes } from "../../../constants/routes";
import { useTehsilManagerOperatorApi } from "../../../hooks";
import { useAuth } from "../../../contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Loader2, Send, ArrowLeft, ChevronRight } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "../../../components/ui/alert";
import { Separator } from "../../../components/ui/separator";
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

const SolarSystemForm = () => {
  const { user } = useAuth();
  const { createSolarSystem, getSolarSystemConfig } =
    useTehsilManagerOperatorApi();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType }>({
    message: "",
    type: "success",
  });
  const [activeStep, setActiveStep] = useState(1); // 1: Location, 2: Technical, 3: Metering

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

  const [systemExists, setSystemExists] = useState(false);
  const RequiredMark = () => (
    <span className="ml-1 text-xs font-semibold text-destructive">*</span>
  );

  useEffect(() => {
    if (!hasResolvedProfileTehsils || tehsilSelectOptions.length === 0) return;
    setFormData((prev) => {
      if (prev.tehsil) return prev;
      const next = tehsilSelectOptions[0];
      if (next === undefined) return prev;
      return { ...prev, tehsil: next, village: "", settlement: "" };
    });
  }, [hasResolvedProfileTehsils, tehsilSelectOptions]);

  const editMode = false;

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
      !editMode &&
      (name === "tehsil" || name === "village" || name === "settlement") &&
      newTehsil &&
      newVillage
    ) {
      try {
        const result = await getSolarSystemConfig(
          newTehsil,
          newVillage,
          newSettlement || "",
        );
        if (result.exists && result.config) {
          setToast({
            message: "⚠️ Location already has an active solar site.",
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

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await createSolarSystem({ ...formData });
      setToast({ message: "Solar site registered.", type: "success" });
      setTimeout(() => navigate(tehsilRoutes.solarSites), 1200);
    } catch (err: unknown) {
      setToast({
        message: getApiErrorMessage(err, "Save failed"),
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    {
      id: 1,
      label: "Geography",
      hint: "Select tehsil, village, and settlement",
    },
    {
      id: 2,
      label: "PV Assets",
      hint: "Capture capacity and commissioning details",
    },
    {
      id: 3,
      label: "Integration",
      hint: "Metering and grid connection details",
    },
  ];

  const REQUIRED_FIELDS_BY_STEP: Record<
    number,
    Array<keyof typeof formData>
  > = {
    1: ["tehsil", "village", "installation_location"],
    2: [
      "solar_panel_capacity",
      "inverter_capacity",
      "inverter_serial_number",
      "installation_date",
    ],
    3: ["meter_model", "meter_serial_number", "green_meter_connection_date"],
  };

  const FIELD_LABELS: Record<keyof typeof formData, string> = {
    tehsil: "Tehsil",
    village: "Village",
    settlement: "Settlement",
    latitude: "Latitude",
    longitude: "Longitude",
    installation_location: "Installation Type",
    solar_panel_capacity: "PV Capacity",
    inverter_capacity: "Inverter Capacity",
    inverter_serial_number: "Inverter Serial",
    installation_date: "Commissioning Date",
    meter_model: "Meter Model",
    meter_serial_number: "Meter Serial",
    green_meter_connection_date: "Green Meter Connection Date",
    remarks: "Technical Remarks",
  };

  const validateStep = (stepToValidate: number) => {
    const requiredFields = REQUIRED_FIELDS_BY_STEP[stepToValidate] ?? [];
    const missing = requiredFields.filter(
      (field) => !String(formData[field]).trim(),
    );

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
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Register solar site
            </h1>
            <p className="text-sm text-muted-foreground">
              Register the site once, then log monthly import/export in Solar
              monthly logs.
            </p>
          </div>
        </div>

        <FormStepper
          steps={steps}
          currentStep={activeStep}
          onStepClick={attemptStepChange}
          className="mb-8"
        />

        <motion.div
          key={activeStep}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-base">
                {activeStep === 1
                  ? "Location"
                  : activeStep === 2
                    ? "PV assets"
                    : "Metering & grid"}
              </CardTitle>
              <CardDescription>
                {activeStep === 1
                  ? "Pick where the solar site is installed."
                  : activeStep === 2
                    ? "Capacity and commissioning details."
                    : "Meter details and grid connection date."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {systemExists ? (
                <Alert className="border-amber-200 bg-amber-50 text-amber-950">
                  <AlertTitle>
                    Solar site already exists at this location
                  </AlertTitle>
                  <AlertDescription>
                    Change tehsil/village/settlement or open the existing site
                    from{" "}
                    <button
                      type="button"
                      className="font-semibold underline underline-offset-4"
                      onClick={() => navigate(tehsilRoutes.solarSites)}
                    >
                      Solar sites
                    </button>
                    .
                  </AlertDescription>
                </Alert>
              ) : null}
              {activeStep === 1 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>
                      Tehsil
                      <RequiredMark />
                      {tehsilSelectLocked ? (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          (your tehsil)
                        </span>
                      ) : null}
                    </Label>
                    <Select
                      value={formData.tehsil || "__empty__"}
                      disabled={tehsilSelectLocked}
                      onValueChange={(v) => {
                        if (v == null) return;
                        void handleFieldChange(
                          "tehsil",
                          v === "__empty__" ? "" : v,
                        );
                      }}
                    >
                      <SelectTrigger className="h-11 w-full">
                        <SelectValue placeholder="Select Tehsil" />
                      </SelectTrigger>
                      <SelectContent>
                        {!tehsilSelectLocked ? (
                          <SelectItem value="__empty__">
                            Select Tehsil
                          </SelectItem>
                        ) : null}
                        {tehsilSelectOptions.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>
                      Village
                      <RequiredMark />
                    </Label>
                    <Select
                      value={formData.village || "__empty__"}
                      onValueChange={(v) => {
                        if (v == null) return;
                        void handleFieldChange(
                          "village",
                          v === "__empty__" ? "" : v,
                        );
                      }}
                    >
                      <SelectTrigger
                        className="h-11 w-full"
                        disabled={!formData.tehsil}
                      >
                        <SelectValue placeholder="Select Village" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__empty__">
                          Select Village
                        </SelectItem>
                        {(LOCATION_DATA[formData.tehsil] || []).map((v) => (
                          <SelectItem key={v} value={v}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Settlement (Optional)</Label>
                    <Select
                      value={formData.settlement || "__empty__"}
                      onValueChange={(v) => {
                        if (v == null) return;
                        void handleFieldChange(
                          "settlement",
                          v === "__empty__" ? "" : v,
                        );
                      }}
                    >
                      <SelectTrigger
                        className="h-11 w-full"
                        disabled={!formData.village}
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
                  </div>

                  <div className="space-y-2">
                    <Label>Latitude (Optional)</Label>
                    <Input
                      type="number"
                      name="latitude"
                      value={formData.latitude}
                      onChange={handleChange}
                      placeholder="e.g. 29.99812"
                      className="h-11"
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
                      placeholder="e.g. 73.25291"
                      className="h-11"
                      disabled={loading}
                      inputMode="decimal"
                    />
                    <p className="text-xs text-muted-foreground">
                      GPS coordinate for mapping and analytics.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>
                      Installation Type
                      <RequiredMark />
                    </Label>
                    <Input
                      name="installation_location"
                      value={formData.installation_location}
                      onChange={handleChange}
                      placeholder="Ground mounted, rooftop, etc."
                      className="h-11"
                    />
                    <p className="text-xs text-muted-foreground">
                      Example: rooftop / ground-mounted / canal-side.
                    </p>
                  </div>
                </div>
              ) : null}

              {activeStep === 2 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>
                      PV Capacity (kWp)
                      <RequiredMark />
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      name="solar_panel_capacity"
                      value={formData.solar_panel_capacity}
                      onChange={handleChange}
                      className="h-11"
                      placeholder="0.0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Inverter Capacity (kVA)
                      <RequiredMark />
                    </Label>
                    <Input
                      type="number"
                      step="0.1"
                      name="inverter_capacity"
                      value={formData.inverter_capacity}
                      onChange={handleChange}
                      className="h-11"
                      placeholder="0.0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Inverter Serial
                      <RequiredMark />
                    </Label>
                    <Input
                      name="inverter_serial_number"
                      value={formData.inverter_serial_number}
                      onChange={handleChange}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Commissioning Date
                      <RequiredMark />
                    </Label>
                    <Input
                      type="date"
                      name="installation_date"
                      value={formData.installation_date}
                      onChange={handleChange}
                      className="h-11"
                    />
                  </div>
                </div>
              ) : null}

              {activeStep === 3 ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>
                        Meter Model
                        <RequiredMark />
                      </Label>
                      <Input
                        name="meter_model"
                        value={formData.meter_model}
                        onChange={handleChange}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>
                        Meter Serial
                        <RequiredMark />
                      </Label>
                      <Input
                        name="meter_serial_number"
                        value={formData.meter_serial_number}
                        onChange={handleChange}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>
                        Green Meter Connection Date
                        <RequiredMark />
                      </Label>
                      <Input
                        type="date"
                        name="green_meter_connection_date"
                        value={formData.green_meter_connection_date}
                        onChange={handleChange}
                        className="h-11"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Technical Remarks</Label>
                    <Textarea
                      name="remarks"
                      value={formData.remarks}
                      onChange={handleChange}
                      placeholder="Maintenance cycles, shadow analysis notes, etc."
                      className="min-h-24 resize-none"
                    />
                  </div>
                </div>
              ) : null}

              <Separator />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {activeStep > 1 ? (
                  <Button
                    variant="outline"
                    onClick={() => setActiveStep((prev) => prev - 1)}
                  >
                    Return
                  </Button>
                ) : (
                  <div />
                )}

                <div className="flex flex-wrap justify-end gap-2">
                  {activeStep < 3 ? (
                    <Button
                      onClick={() => attemptStepChange(activeStep + 1)}
                      className="gap-2"
                    >
                      Continue <ChevronRight className="size-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={() => void handleSubmit()}
                      disabled={
                        loading ||
                        systemExists ||
                        !formData.tehsil ||
                        !formData.village
                      }
                      className="gap-2"
                    >
                      {loading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Send className="size-4" />
                      )}
                      Register site
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

export default SolarSystemForm;
