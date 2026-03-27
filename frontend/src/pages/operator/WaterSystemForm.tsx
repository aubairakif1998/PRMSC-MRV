import { useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useOperatorApi } from "../../hooks";
import { motion, AnimatePresence } from "framer-motion";
import {
  Droplets,
  Loader2,
  Save,
  Send,
  ArrowLeft,
  MapPin,
  Settings,
  Gauge,
  CheckCircle,
  AlertCircle,
  Info,
  ChevronRight,
  Calendar,
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
const WaterSystemForm = () => {
  const { createWaterSystem, getWaterSystemConfig } = useOperatorApi();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType }>({
    message: "",
    type: "success",
  });
  const [activeStep, setActiveStep] = useState(1); // 1: Location, 2: Equipment, 3: Metering

  const [formData, setFormData] = useState({
    tehsil: "",
    village: "",
    settlement: "",
    pump_model: "",
    pump_serial_number: "",
    start_of_operation: "",
    depth_of_water_intake: "",
    height_to_ohr: "",
    pump_flow_rate: "",
    meter_model: "",
    meter_serial_number: "",
    meter_accuracy_class: "",
    calibration_requirement: "",
    installation_date: "",
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
        const result = await getWaterSystemConfig(
          newTehsil,
          newVillage,
          newSettlement || "",
        );
        if (result.exists && result.config) {
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

  const handleSubmit = async (status: SubmissionStatus) => {
    setLoading(true);
    try {
      await createWaterSystem({ ...formData, status });
      setToast({
        message:
          status === "draft" ? " Draft saved!" : "✅ Registration complete!",
        type: "success",
      });
      if (status === "submitted") setTimeout(() => navigate("/operator"), 1500);
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
    2: [
      "pump_model",
      "pump_serial_number",
      "pump_flow_rate",
      "installation_date",
      "start_of_operation",
    ],
    3: ["meter_model", "meter_serial_number", "meter_accuracy_class"],
  };

  const FIELD_LABELS: Record<keyof typeof formData, string> = {
    tehsil: "Tehsil",
    village: "Village",
    settlement: "Settlement",
    pump_model: "Pump Model",
    pump_serial_number: "Pump Serial Number",
    start_of_operation: "Operation Start",
    depth_of_water_intake: "Intake Depth",
    height_to_ohr: "Height to OHR",
    pump_flow_rate: "Flow Rate",
    meter_model: "Meter Model",
    meter_serial_number: "Meter Serial Number",
    meter_accuracy_class: "Accuracy Class",
    calibration_requirement: "Calibration Notes",
    installation_date: "Installation Date",
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
        <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-sm">
          <Droplets className="size-6" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900">
            Register Water System
          </h1>
          <p className="text-sm text-slate-600">
            Establish key infrastructure parameters for monitoring
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
                    onValueChange={(v) => {
                      if (!v) return;
                      handleFieldChange("tehsil", v === "__empty__" ? "" : v);
                    }}
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
                    onValueChange={(v) => {
                      if (!v) return;
                      handleFieldChange("village", v === "__empty__" ? "" : v);
                    }}
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
              </div>
            ) : null}

            {activeStep === 2 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Pump Model</Label>
                  <Input
                    name="pump_model"
                    value={formData.pump_model}
                    onChange={handleChange}
                    className="h-11"
                    placeholder="e.g. Grundfos CRI"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Serial Number</Label>
                  <Input
                    name="pump_serial_number"
                    value={formData.pump_serial_number}
                    onChange={handleChange}
                    className="h-11"
                    placeholder="SN-XXXX"
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
                  />
                </div>
                <div className="space-y-2">
                  <Label>Flow Rate (m³/h)</Label>
                  <Input
                    type="number"
                    name="pump_flow_rate"
                    value={formData.pump_flow_rate}
                    onChange={handleChange}
                    className="h-11"
                    placeholder="0.0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Installation Date</Label>
                  <Input
                    type="date"
                    name="installation_date"
                    value={formData.installation_date}
                    onChange={handleChange}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Operation Start</Label>
                  <Input
                    type="date"
                    name="start_of_operation"
                    value={formData.start_of_operation}
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
                </div>
                <div className="space-y-2">
                  <Label>Accuracy Class</Label>
                  <Input
                    name="meter_accuracy_class"
                    value={formData.meter_accuracy_class}
                    onChange={handleChange}
                    placeholder="e.g. Class B"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Calibration Notes</Label>
                  <Textarea
                    name="calibration_requirement"
                    value={formData.calibration_requirement}
                    onChange={handleChange}
                    placeholder="Frequency, last calibration, etc."
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
                  Previous Step
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
                  Save Draft
                </Button>
                {activeStep < 3 ? (
                  <Button
                    onClick={() => attemptStepChange(activeStep + 1)}
                    className="gap-2"
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
                    Complete Registration
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

export default WaterSystemForm;
