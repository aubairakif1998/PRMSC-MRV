import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useOperatorApi } from "../../hooks";
import Toast from "../../components/Toast";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { FormStepper } from "../../components/ui/form-stepper";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { getApiErrorMessage } from "../../lib/api-error";
import {
  Droplets,
  Save,
  Send,
  Info,
  Calendar,
  ChevronDown,
  ChevronUp,
  Camera,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";

type ToastType = "success" | "error";
type SubmissionStatus = "draft" | "submitted";

type RegisteredWaterSystem = {
  id: string | number;
  tehsil: string;
  village: string;
  settlement?: string;
  pump_flow_rate?: number | null;
};

type WaterLocation = {
  id: number;
  tehsil: string;
  village: string;
  settlement: string;
  /** Monthly total from the physical water meter (m³). */
  totalWater: string;
};

type WaterDraft = {
  year: number;
  month: number;
  tehsil?: string;
  village?: string;
  settlement?: string;
  pump_operating_hours?: string;
  total_water_pumping?: string;
};

type WaterSupplyRecord = {
  month: number;
  pump_operating_hours?: string;
  total_water_pumped?: string;
};

const sanitizeDecimalInput = (raw: string) => {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const [integerPart = "", ...decimalParts] = cleaned.split(".");
  const decimalPart = decimalParts.join("");
  return decimalParts.length > 0 ? `${integerPart}.${decimalPart}` : integerPart;
};

const MONTHS = [
  { name: "January", num: 1 },
  { name: "February", num: 2 },
  { name: "March", num: 3 },
  { name: "April", num: 4 },
  { name: "May", num: 5 },
  { name: "June", num: 6 },
  { name: "July", num: 7 },
  { name: "August", num: 8 },
  { name: "September", num: 9 },
  { name: "October", num: 10 },
  { name: "November", num: 11 },
  { name: "December", num: 12 },
];

const currentDate = new Date();
const currentMonth = currentDate.getMonth() + 1;
const currentYear = currentDate.getFullYear();

const WaterSupplyDataForm = () => {
  const {
    getWaterSupplyData,
    saveWaterSupplyData,
    getWaterDraft,
    getWaterSystems,
    uploadImage,
  } = useOperatorApi();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [locations, setLocations] = useState<WaterLocation[]>([
    {
      id: 1,
      tehsil: "",
      village: "",
      settlement: "",
      totalWater: "",
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType }>({
    message: "",
    type: "success",
  });
  const [step, setStep] = useState(1);
  const [expandedLocation, setExpandedLocation] = useState(0);
  const [prefilledSystemId, setPrefilledSystemId] = useState<string | null>(null);
  const [existingLoggedTotal, setExistingLoggedTotal] = useState(0);
  const [registeredSystems, setRegisteredSystems] = useState<
    RegisteredWaterSystem[]
  >([]);
  const [attachment, setAttachment] = useState<File | null>(null);
  const steps = [
    { id: 1, label: "Period", hint: "Choose reporting month and year" },
    {
      id: 2,
      label: "Locations",
      hint: "Enter site-wise operational water data",
    },
  ];

  const validateStep = (stepToValidate: number) => {
    if (stepToValidate !== 1) return true;

    if (!year || !month) {
      setToast({
        message: "Select a valid reporting month and year to continue.",
        type: "error",
      });
      return false;
    }

    return true;
  };

  const validateSubmissionData = (status: SubmissionStatus) => {
    const currentLocation = locations[0];
    if (!currentLocation) {
      setToast({
        message: "No infrastructure selected for monthly logging.",
        type: "error",
      });
      return false;
    }

    if (
      !currentLocation.tehsil ||
      !currentLocation.village ||
      !currentLocation.settlement
    ) {
      setToast({
        message: "Tehsil, village, and settlement are required.",
        type: "error",
      });
      return false;
    }

    const totalWater = parseFloat(currentLocation.totalWater);
    if (!currentLocation.totalWater || Number.isNaN(totalWater)) {
      setToast({
        message: "Total Water Pumped (m³) is required and must be numeric.",
        type: "error",
      });
      return false;
    }

    if (status === "submitted" && !attachment) {
      setToast({
        message: "Attach a supporting meter image before final submission.",
        type: "error",
      });
      return false;
    }

    return true;
  };

  const attemptStepChange = (targetStep: number) => {
    if (targetStep <= step) {
      setStep(targetStep);
      return;
    }

    for (let stepNumber = step; stepNumber < targetStep; stepNumber += 1) {
      if (!validateStep(stepNumber)) return;
    }

    setStep(targetStep);
  };

  useEffect(() => {
    const fetchSystems = async () => {
      try {
        const systems = await getWaterSystems();
        setRegisteredSystems(systems);
      } catch (err: unknown) {
        setToast({
          message: getApiErrorMessage(err, "Failed to load registered systems"),
          type: "error",
        });
      }
    };
    fetchSystems();
  }, []);

  const validTehsils = [...new Set(registeredSystems.map((s) => s.tehsil))];
  const getValidVillages = (tehsil: string) =>
    [
      ...new Set(
        registeredSystems
          .filter((s) => s.tehsil === tehsil)
          .map((s) => s.village),
      ),
    ].filter(Boolean);
  const getValidSettlements = (village: string) =>
    [
      ...new Set(
        registeredSystems
          .filter((s) => s.village === village)
          .map((s) => s.settlement),
      ),
    ].filter(Boolean);

  const loadDraftData = async (draftId: string | number) => {
    try {
      setLoading(true);
      const draftData = (await getWaterDraft(draftId)) as WaterDraft | null;
      if (draftData) {
        setYear(draftData.year);
        setMonth(draftData.month);
        setLocations([
          {
            id: 1,
            tehsil: draftData.tehsil || "",
            village: draftData.village || "",
            settlement: draftData.settlement || "",
            totalWater: draftData.total_water_pumping || "",
          },
        ]);
        setStep(2);
        setPrefilledSystemId(null);
      }
    } catch (error: unknown) {
      setToast({
        message: getApiErrorMessage(error, "Failed to load draft"),
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSystemData = async (systemId: string | number) => {
    try {
      setLoading(true);
      const systems = (await getWaterSystems()) as RegisteredWaterSystem[];
      const system = systems.find((s) => String(s.id) === String(systemId));
      if (system) {
        setPrefilledSystemId(String(systemId));
        setLocations([
          {
            id: 1,
            tehsil: system.tehsil || "",
            village: system.village || "",
            settlement: system.settlement || "",
            totalWater: "",
          },
        ]);
        setStep(2);
      } else {
        setToast({
          message: "Selected infrastructure could not be found.",
          type: "error",
        });
      }
    } catch (error: unknown) {
      setToast({
        message: getApiErrorMessage(error, "Failed to load system"),
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const draftId = searchParams.get("draft");
    const systemId = searchParams.get("system");
    if (draftId) loadDraftData(draftId);
    else if (systemId) loadSystemData(systemId);
  }, [searchParams]);

  const updateLocationValue = (
    id: number,
    field: keyof WaterLocation,
    value: WaterLocation[keyof WaterLocation],
  ) => {
    setLocations(
      locations.map((l) => (l.id === id ? { ...l, [field]: value } : l)),
    );
  };

  const handleLocationChange = async (
    id: number,
    field: keyof WaterLocation | "tehsil" | "village" | "settlement",
    value: string,
  ) => {
    const idx = locations.findIndex((l) => l.id === id);
    if (idx === -1) return;
    let newLocations = [...locations];

    if (field === "tehsil") {
      newLocations[idx] = {
        ...newLocations[idx]!,
        tehsil: value,
        village: "",
        settlement: "",
        totalWater: "",
      };
    } else if (field === "village") {
      newLocations[idx] = {
        ...newLocations[idx]!,
        village: value,
        settlement: "",
        totalWater: "",
      };
    } else if (field === "settlement") {
      newLocations[idx] = {
        ...newLocations[idx]!,
        settlement: value,
        totalWater: "",
      };
    } else {
      newLocations[idx] = { ...newLocations[idx]!, [field]: value };
    }

    setLocations(newLocations);

    const currentLocation = newLocations[idx];
    if (!currentLocation) return;
    const newTehsil = field === "tehsil" ? value : currentLocation.tehsil;
    const newVillage = field === "village" ? value : currentLocation.village;
    const newSettlement =
      field === "settlement" ? value : currentLocation.settlement;

    if (newTehsil && newVillage) {
      try {
        const data = (await getWaterSupplyData({
          tehsil: newTehsil,
          village: newVillage,
          settlement: newSettlement || "",
          year,
        })) as WaterSupplyRecord[];
        if (data && data.length > 0) {
          const historyTotal = data.reduce(
            (sum, record) =>
              record.month === month
                ? sum
                : sum + (parseFloat(record.total_water_pumped || "0") || 0),
            0,
          );
          setExistingLoggedTotal(historyTotal);

          const monthData = data.find(
            (d: WaterSupplyRecord) => d.month === month,
          );
          if (monthData) {
            newLocations[idx]!.totalWater = monthData.total_water_pumped || "";
          }
        }
        if (!data || data.length === 0) {
          setExistingLoggedTotal(0);
        }
        setLocations([...newLocations]);
      } catch (err: unknown) {
        setToast({
          message: getApiErrorMessage(err, "Could not load water supply data"),
          type: "error",
        });
      }
    }
  };

  useEffect(() => {
    const currentLocation = locations[0];
    if (!currentLocation?.tehsil || !currentLocation?.village) {
      setExistingLoggedTotal(0);
      return;
    }

    const loadExistingTotals = async () => {
      try {
        const data = (await getWaterSupplyData({
          tehsil: currentLocation.tehsil,
          village: currentLocation.village,
          settlement: currentLocation.settlement || "",
          year,
        })) as WaterSupplyRecord[];

        const historyTotal = (data || []).reduce(
          (sum, record) =>
            record.month === month
              ? sum
              : sum + (parseFloat(record.total_water_pumped || "0") || 0),
          0,
        );
        setExistingLoggedTotal(historyTotal);
      } catch {
        setExistingLoggedTotal(0);
      }
    };

    void loadExistingTotals();
  }, [
    year,
    month,
    locations[0]?.tehsil,
    locations[0]?.village,
    locations[0]?.settlement,
  ]);

  const submitData = async (status: SubmissionStatus) => {
    if (!validateSubmissionData(status)) return;
    setLoading(true);
    try {
      let imagePath = null;
      if (attachment) {
        const uploadRes = await uploadImage(attachment, "temp", "water");
        imagePath = uploadRes.image_url || uploadRes.path || null;
      }

      const payload = {
        data: locations.map((loc) => ({
          tehsil: loc.tehsil,
          village: loc.village,
          settlement: loc.settlement,
          monthlyData: [
            {
              month: month,
              pump_operating_hours: null,
              total_water_pumped:
                loc.totalWater.trim() === "" ? null : loc.totalWater,
            },
          ],
        })),
        year: year,
        status: status,
        image_url: imagePath,
        image_path: imagePath,
      };

      await saveWaterSupplyData(payload);
      setToast({
        message: status === "draft" ? " Progress saved!" : "✅ Data submitted!",
        type: "success",
      });
      if (status === "submitted")
        setTimeout(() => navigate("/operator/water-submissions"), 1500);
    } catch (err: unknown) {
      setToast({
        message: getApiErrorMessage(err, "Error occurred"),
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        padding: "32px",
        maxWidth: "1000px",
        margin: "0 auto",
        background: "#f8fafc",
        minHeight: "100vh",
      }}
    >
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: "", type: "success" })}
      />

      {/* Modern Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "40px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <motion.div whileHover={{ scale: 1.05 }} style={iconBoxStyle}>
            <Droplets size={32} color="white" />
          </motion.div>
          <div>
            <h1
              style={{
                fontSize: "32px",
                fontWeight: "900",
                color: "#1e293b",
                letterSpacing: "-0.02em",
                margin: 0,
              }}
            >
              Water Supply Entry
            </h1>
            <p style={{ color: "#64748b", fontSize: "16px", marginTop: "4px" }}>
              Systematic reporting for monthly operational metrics
            </p>
          </div>
        </div>
        {step === 2 && (
          <div
            style={{
              background: "white",
              padding: "10px 20px",
              borderRadius: "14px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
            }}
          >
            <span
              style={{
                color: "#94a3b8",
                fontSize: "13px",
                fontWeight: "600",
                textTransform: "uppercase",
              }}
            >
              Period:
            </span>
            <span
              style={{
                color: "#0ea5e9",
                fontSize: "15px",
                fontWeight: "800",
                marginLeft: "10px",
              }}
            >
              {MONTHS.find((m) => m.num === month)?.name} {year}
            </span>
          </div>
        )}
      </div>

      <FormStepper
        steps={steps}
        currentStep={step}
        onStepClick={attemptStepChange}
        className="mb-8"
      />

      <AnimatePresence mode="wait">
        {step === 1 ? (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            style={premiumCardStyle}
          >
            <div style={{ padding: "32px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "32px",
                }}
              >
                <Calendar size={24} color="#0ea5e9" />
                <h2
                  style={{
                    fontSize: "20px",
                    fontWeight: "800",
                    color: "#334155",
                  }}
                >
                  Select Reporting Period
                </h2>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "24px",
                  marginBottom: "40px",
                }}
              >
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Year</label>
                  <Select
                    value={String(year)}
                    onValueChange={(v) => v && setYear(Number(v))}
                  >
                    <SelectTrigger
                      className="h-12 w-full rounded-xl border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700"
                      disabled
                    >
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={String(currentYear)}>
                        {currentYear}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Month</label>
                  <Select
                    value={String(month)}
                    onValueChange={(v) => v && setMonth(Number(v))}
                  >
                    <SelectTrigger className="h-12 w-full rounded-xl border-slate-200 bg-white text-sm font-semibold text-slate-700">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m) => (
                        <SelectItem
                          key={m.num}
                          value={String(m.num)}
                          disabled={m.num !== currentMonth}
                        >
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div style={infoBoxStyle}>
                <Info size={20} color="#0ea5e9" />
                <p
                  style={{
                    margin: 0,
                    color: "#334155",
                    fontSize: "14px",
                    lineHeight: "1.6",
                  }}
                >
                  Please ensure the period matches your physical meter readings
                  or pump logs. Data entered for the wrong period will result in
                  verification discrepancies.
                </p>
              </div>

              <Button
                onClick={() => attemptStepChange(2)}
                className="mt-8 h-11 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Proceed to Entry <ChevronDown size={20} />
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "24px",
              }}
            >
              <Button
                variant="outline"
                className="h-10 gap-2"
                onClick={() => setStep(1)}
              >
                <ArrowLeft size={18} /> Back to Selection
              </Button>
              <Badge variant="outline" className="h-10 rounded-xl px-4 text-slate-700">
                Single Infrastructure Logging
              </Badge>
            </div>

            <div
              style={{ display: "flex", flexDirection: "column", gap: "24px" }}
            >
              {locations.map((loc, idx) => (
                <motion.div key={loc.id} style={premiumCardStyle}>
                  <div
                    style={cardHeaderStyle}
                    onClick={() =>
                      setExpandedLocation(expandedLocation === idx ? -1 : idx)
                    }
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "16px",
                      }}
                    >
                      <div
                        style={{
                          ...indexBoxStyle,
                          background:
                            expandedLocation === idx ? "#0ea5e9" : "#f1f5f9",
                          color: expandedLocation === idx ? "white" : "#64748b",
                        }}
                      >
                        {idx + 1}
                      </div>
                      <div>
                        <h3
                          style={{
                            margin: 0,
                            fontSize: "18px",
                            fontWeight: "800",
                            color: "#1e293b",
                          }}
                        >
                          {loc.tehsil
                            ? `${loc.tehsil} • ${loc.village}`
                            : "Select Facility Location"}
                        </h3>
                        {prefilledSystemId !== null && idx === 0 && (
                          <Badge variant="outline" className="mt-1 border-primary/30 text-primary">
                            Prefilled from registered system
                          </Badge>
                        )}
                        {loc.settlement && (
                          <span style={{ fontSize: "13px", color: "#94a3b8" }}>
                            {loc.settlement}
                          </span>
                        )}
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "20px",
                      }}
                    >
                      {loc.totalWater && (
                        <div style={valueBadgeStyle}>{loc.totalWater} m³</div>
                      )}
                      {expandedLocation === idx ? (
                        <ChevronUp size={24} />
                      ) : (
                        <ChevronDown size={24} />
                      )}
                    </div>
                  </div>

                  {expandedLocation === idx && (
                    <div
                      style={{
                        padding: "0 32px 32px 32px",
                        borderTop: "1px solid #f1f5f9",
                        marginTop: "0",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(3, 1fr)",
                          gap: "24px",
                          paddingTop: "32px",
                        }}
                      >
                        <div style={inputGroupStyle}>
                          <label style={labelStyle}>Tehsil</label>
                          <Select
                            value={loc.tehsil || "__empty__"}
                            onValueChange={(value) => {
                              if (!value) return;
                              handleLocationChange(
                                loc.id,
                                "tehsil",
                                value === "__empty__" ? "" : value,
                              );
                            }}
                          >
                            <SelectTrigger
                              className="h-11 w-full rounded-xl border-slate-200 bg-white"
                              disabled={prefilledSystemId !== null && idx === 0}
                            >
                              <SelectValue placeholder="Select Tehsil" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__empty__">Select Tehsil</SelectItem>
                              {validTehsils.map((t) => (
                                <SelectItem key={t} value={t}>
                                  {t}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div style={inputGroupStyle}>
                          <label style={labelStyle}>Village</label>
                          <Select
                            value={loc.village || "__empty__"}
                            onValueChange={(value) => {
                              if (!value) return;
                              handleLocationChange(
                                loc.id,
                                "village",
                                value === "__empty__" ? "" : value,
                              );
                            }}
                          >
                            <SelectTrigger
                              className="h-11 w-full rounded-xl border-slate-200 bg-white"
                              disabled={
                                !loc.tehsil || (prefilledSystemId !== null && idx === 0)
                              }
                            >
                              <SelectValue placeholder="Select Village" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__empty__">Select Village</SelectItem>
                              {getValidVillages(loc.tehsil).map((v) => (
                                <SelectItem key={v} value={v}>
                                  {v}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div style={inputGroupStyle}>
                          <label style={labelStyle}>Settlement</label>
                          <Select
                            value={loc.settlement || "__empty__"}
                            onValueChange={(value) => {
                              if (!value) return;
                              handleLocationChange(
                                loc.id,
                                "settlement",
                                value === "__empty__" ? "" : value,
                              );
                            }}
                          >
                            <SelectTrigger
                              className="h-11 w-full rounded-xl border-slate-200 bg-white"
                              disabled={
                                !loc.village || (prefilledSystemId !== null && idx === 0)
                              }
                            >
                              <SelectValue placeholder="Select Settlement" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__empty__">Select Settlement</SelectItem>
                              {getValidSettlements(loc.village).map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div
                        style={{
                          marginTop: "32px",
                          padding: "24px",
                          background: "#f8fafc",
                          borderRadius: "16px",
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        <p
                          style={{
                            margin: "0 0 16px 0",
                            fontSize: "14px",
                            lineHeight: 1.6,
                            color: "#64748b",
                          }}
                        >
                          Enter the monthly total from your <strong style={{ color: "#334155" }}>water meter</strong> reading (m³).
                        </p>
                        <div style={inputGroupStyle}>
                          <label style={labelStyle}>
                            Total Water Pumped (m³)
                          </label>
                          <input
                            type="number"
                            style={{
                              ...inputStyle,
                              fontWeight: "800",
                              color: "#0ea5e9",
                            }}
                            value={loc.totalWater}
                            onChange={(e) =>
                              updateLocationValue(
                                loc.id,
                                "totalWater",
                                sanitizeDecimalInput(e.target.value),
                              )
                            }
                            inputMode="decimal"
                            min="0"
                            step="any"
                            pattern="[0-9]*\.?[0-9]+"
                            placeholder="0.0"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Evidence & Action Trail */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 350px",
                gap: "32px",
                marginTop: "40px",
              }}
            >
              <div style={premiumCardStyle}>
                <div style={{ padding: "32px" }}>
                  <h3
                    style={{
                      fontSize: "20px",
                      fontWeight: "800",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      margin: "0 0 24px 0",
                    }}
                  >
                    <Camera size={24} color="#0ea5e9" /> Supporting Evidence
                  </h3>
                  <div
                    style={{
                      border: "2px dashed #e2e8f0",
                      borderRadius: "20px",
                      padding: "40px",
                      textAlign: "center",
                      cursor: "pointer",
                      background: attachment ? "#f0f9ff" : "transparent",
                      transition: "all 0.2s",
                    }}
                    onClick={() => {
                      const fileInput = document.getElementById(
                        "file-input",
                      ) as HTMLInputElement | null;
                      fileInput?.click();
                    }}
                  >
                    <input
                      type="file"
                      id="file-input"
                      hidden
                      onChange={(e) =>
                        setAttachment(e.target.files?.[0] ?? null)
                      }
                      accept="image/*"
                    />
                    {!attachment ? (
                      <>
                        <Camera
                          size={48}
                          color="#94a3b8"
                          style={{ margin: "0 auto 16px auto" }}
                        />
                        <p
                          style={{
                            fontWeight: "700",
                            color: "#475569",
                            margin: 0,
                          }}
                        >
                          Click to upload meter photograph
                        </p>
                        <p
                          style={{
                            fontSize: "13px",
                            color: "#94a3b8",
                            marginTop: "4px",
                          }}
                        >
                          Clear JPG/PNG required for audit
                        </p>
                      </>
                    ) : (
                      <>
                        <CheckCircle2
                          size={48}
                          color="#10b981"
                          style={{ margin: "0 auto 16px auto" }}
                        />
                        <p
                          style={{
                            fontWeight: "700",
                            color: "#047857",
                            margin: 0,
                          }}
                        >
                          {attachment.name}
                        </p>
                        <p
                          style={{
                            fontSize: "13px",
                            color: "#059669",
                            marginTop: "4px",
                          }}
                        >
                          Click to replace file
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div
                style={{
                  ...premiumCardStyle,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  padding: "32px",
                  background: "linear-gradient(135deg, #0f172a, #1e293b)",
                  border: "none",
                }}
              >
                <div
                  style={{
                    color: "rgba(255,255,255,0.6)",
                    fontSize: "13px",
                    fontWeight: "700",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginBottom: "12px",
                  }}
                >
                  Aggregated Total
                </div>
                <div
                  style={{
                    color: "white",
                    fontSize: "48px",
                    fontWeight: "900",
                    letterSpacing: "-0.04em",
                  }}
                >
                  {locations
                    .reduce(
                      (sum, l) => sum + (parseFloat(l.totalWater) || 0),
                      0,
                    )
                    .toFixed(1)}{" "}
                  <span
                    style={{
                      fontSize: "20px",
                      fontWeight: "400",
                      color: "rgba(255,255,255,0.4)",
                    }}
                  >
                    m³
                  </span>
                </div>
                <div style={{ color: "rgba(255,255,255,0.72)", fontSize: "13px", marginTop: "4px" }}>
                  Existing logged: {existingLoggedTotal.toFixed(1)} m³
                </div>
                <div style={{ color: "rgba(255,255,255,0.72)", fontSize: "13px" }}>
                  Combined total:{" "}
                  {(
                    existingLoggedTotal +
                    locations.reduce(
                      (sum, l) => sum + (parseFloat(l.totalWater) || 0),
                      0,
                    )
                  ).toFixed(1)}{" "}
                  m³
                </div>
                <div
                  style={{
                    height: "1px",
                    background: "rgba(255,255,255,0.1)",
                    margin: "24px 0",
                  }}
                ></div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                  }}
                >
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={submitButtonStyle}
                    onClick={() => submitData("submitted")}
                    disabled={loading}
                  >
                    <Send size={18} /> Complete Submission
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={saveButtonStyle}
                    onClick={() => submitData("draft")}
                    disabled={loading}
                  >
                    <Save size={18} /> Save as Draft
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Simplified Styles
const iconBoxStyle = {
  width: "64px",
  height: "64px",
  borderRadius: "20px",
  background: "linear-gradient(135deg, #0ea5e9, #3b82f6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 10px 15px -3px rgba(14, 165, 233, 0.4)",
};
const premiumCardStyle = {
  background: "white",
  borderRadius: "28px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -2px rgba(0,0,0,0.02)",
  overflow: "hidden",
};
const inputGroupStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "10px",
};
const labelStyle = {
  fontSize: "13px",
  fontWeight: "700",
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.02em",
};
const inputStyle = {
  padding: "16px",
  borderRadius: "16px",
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  fontSize: "15px",
  fontWeight: "600",
  color: "#1e293b",
  outline: "none",
  transition: "border-color 0.2s",
  width: "100%",
  appearance: "none" as const,
};
const infoBoxStyle = {
  display: "flex",
  gap: "16px",
  padding: "20px",
  background: "#f0f9ff",
  borderRadius: "18px",
  border: "1px solid #bae6fd",
  marginBottom: "32px",
};
const primaryButtonStyle = {
  width: "100%",
  padding: "18px",
  background: "#1e293b",
  color: "white",
  border: "none",
  borderRadius: "18px",
  fontSize: "16px",
  fontWeight: "800",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "12px",
};
const backButtonStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  background: "white",
  padding: "10px 20px",
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
  color: "#475569",
  fontSize: "14px",
  fontWeight: "700",
  cursor: "pointer",
};
const whiteButtonStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  background: "#0ea5e9",
  padding: "10px 20px",
  borderRadius: "12px",
  border: "none",
  color: "white",
  fontSize: "14px",
  fontWeight: "700",
  cursor: "pointer",
  boxShadow: "0 4px 6px -1px rgba(14, 165, 233, 0.2)",
};
const cardHeaderStyle = {
  padding: "32px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  cursor: "pointer",
};
const indexBoxStyle = {
  width: "40px",
  height: "40px",
  borderRadius: "12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "800",
  fontSize: "16px",
};
const valueBadgeStyle = {
  padding: "8px 16px",
  background: "#f0f9ff",
  color: "#0ea5e9",
  borderRadius: "10px",
  fontWeight: "800",
  fontSize: "14px",
};
const submitButtonStyle = {
  padding: "16px",
  background: "#0ea5e9",
  color: "white",
  border: "none",
  borderRadius: "16px",
  fontWeight: "900",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
};
const saveButtonStyle = {
  padding: "16px",
  background: "rgba(255,255,255,0.05)",
  color: "white",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "16px",
  fontWeight: "700",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
};

export default WaterSupplyDataForm;
