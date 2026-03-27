import { useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useOperatorApi } from "../../hooks";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sun,
  Loader2,
  Save,
  Send,
  Settings,
  MapPin,
  Zap,
  Calendar,
  Info,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import Toast from "../../components/Toast";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { FormStepper } from "../../components/ui/form-stepper";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { getApiErrorMessage } from "../../lib/api-error";
import {
  TEHSIL_OPTIONS,
  LOCATION_DATA,
  SETTLEMENT_DATA,
} from "../../utils/locationData";

type ToastType = "success" | "error";
type SubmissionStatus = "draft" | "submitted";
const SolarSystemForm = () => {
  const { createSolarSystem, getSolarSystemConfig } = useOperatorApi();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType }>({
    message: "",
    type: "success",
  });
  const [activeStep, setActiveStep] = useState(1); // 1: Location, 2: Technical, 3: Metering

  const [formData, setFormData] = useState({
    tehsil: "",
    village: "",
    settlement: "",
    installation_location: "",
    solar_panel_capacity: "",
    inverter_capacity: "",
    inverter_serial_number: "",
    installation_date: "",
    meter_model: "",
    meter_serial_number: "",
    green_meter_connection_date: "",
    calibration_date: "",
    remarks: "",
  });

  const [systemExists, setSystemExists] = useState(false);

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

  const handleSubmit = async (status: SubmissionStatus) => {
    setLoading(true);
    try {
      await createSolarSystem({ ...formData, status });
      setToast({
        message: status === "draft" ? " Draft updated!" : "✅ Site registered!",
        type: "success",
      });
      if (status === "submitted") setTimeout(() => navigate("/operator"), 1500);
    } catch (err: unknown) {
      setToast({
        message: getApiErrorMessage(err, "Update failed"),
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
      hint: "Complete metering and calibration details",
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
    installation_location: "Installation Type",
    solar_panel_capacity: "PV Capacity",
    inverter_capacity: "Inverter Capacity",
    inverter_serial_number: "Inverter Serial",
    installation_date: "Commissioning Date",
    meter_model: "Meter Model",
    meter_serial_number: "Meter Serial",
    green_meter_connection_date: "Green Meter Connection Date",
    calibration_date: "Calibration Date",
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
      className="mx-auto min-h-screen w-full max-w-5xl bg-slate-50 p-6"
    >
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: "", type: "success" })}
      />

      <div className="mb-8 flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm">
          <Sun className="size-6" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900">
            Register Solar Site
          </h1>
          <p className="text-sm text-slate-600">
            Configure asset capacity and grid connection details
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
        <Card className="rounded-2xl border-slate-200">
          <CardContent className="space-y-6 p-6">
            {activeStep === 1 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tehsil</Label>
                  <Select
                    value={formData.tehsil || "__empty__"}
                    onValueChange={(v) =>
                      handleFieldChange("tehsil", v === "__empty__" ? "" : v)
                    }
                  >
                    <SelectTrigger className="h-11 w-full">
                      <SelectValue placeholder="Select Tehsil" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__empty__">Select Tehsil</SelectItem>
                      {TEHSIL_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Village</Label>
                  <Select
                    value={formData.village || "__empty__"}
                    onValueChange={(v) =>
                      handleFieldChange("village", v === "__empty__" ? "" : v)
                    }
                  >
                    <SelectTrigger
                      className="h-11 w-full"
                      disabled={!formData.tehsil}
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
                </div>

                <div className="space-y-2">
                  <Label>Settlement (Optional)</Label>
                  <Select
                    value={formData.settlement || "__empty__"}
                    onValueChange={(v) =>
                      handleFieldChange(
                        "settlement",
                        v === "__empty__" ? "" : v,
                      )
                    }
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
                  <Label>Installation Type</Label>
                  <Input
                    name="installation_location"
                    value={formData.installation_location}
                    onChange={handleChange}
                    placeholder="Ground mounted, rooftop, etc."
                    className="h-11"
                  />
                </div>
              </div>
            ) : null}

            {activeStep === 2 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>PV Capacity (kWp)</Label>
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
                  <Label>Inverter Capacity (kVA)</Label>
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
                  <Label>Inverter Serial</Label>
                  <Input
                    name="inverter_serial_number"
                    value={formData.inverter_serial_number}
                    onChange={handleChange}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Commissioning Date</Label>
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
                    <Label>Meter Model</Label>
                    <Input
                      name="meter_model"
                      value={formData.meter_model}
                      onChange={handleChange}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Meter Serial</Label>
                    <Input
                      name="meter_serial_number"
                      value={formData.meter_serial_number}
                      onChange={handleChange}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Green Meter Connection Date</Label>
                    <Input
                      type="date"
                      name="green_meter_connection_date"
                      value={formData.green_meter_connection_date}
                      onChange={handleChange}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Calibration Date</Label>
                    <Input
                      type="date"
                      name="calibration_date"
                      value={formData.calibration_date}
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

            <div className="flex items-center justify-between border-t border-slate-200 pt-4">
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

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => handleSubmit("draft")}
                  disabled={loading || systemExists}
                  className="gap-2"
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Draft
                </Button>
                {activeStep < 3 ? (
                  <Button
                    onClick={() => attemptStepChange(activeStep + 1)}
                    className="gap-2 bg-amber-500 text-white hover:bg-amber-600"
                  >
                    Continue <ChevronRight className="size-4" />
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
                    className="gap-2 bg-orange-600 text-white hover:bg-orange-700"
                  >
                    {loading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    Register Site
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default SolarSystemForm;
