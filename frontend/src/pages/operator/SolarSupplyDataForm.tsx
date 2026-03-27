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
  Sun,
  Save,
  Send,
  Info,
  MapPin,
  Calendar,
  ChevronDown,
  ChevronUp,
  Camera,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Plus,
  Zap,
} from "lucide-react";

type ToastType = "success" | "error";
type SubmissionStatus = "draft" | "submitted";

type RegisteredSolarSystem = {
  id: string | number;
  tehsil: string;
  village: string;
  settlement?: string;
  solar_panel_capacity?: number | null;
};

type SolarLocation = {
  id: number;
  tehsil: string;
  village: string;
  settlement: string;
  hasGreenMeter: boolean;
  solarPanelCapacity: number | null;
  energyConsumed: string;
  energyExported: string;
};

type SolarDraft = {
  year: number;
  month: number;
  tehsil?: string;
  village?: string;
  settlement?: string;
  energy_consumed_from_grid?: string;
  energy_exported_to_grid?: string;
};

type SolarSupplyRecord = {
  month: number;
  energy_consumed_from_grid?: string;
  energy_exported_to_grid?: string;
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

const SolarSupplyDataForm = () => {
  const {
    getSolarSystemConfig,
    getSolarSupplyData,
    saveSolarSupplyData,
    getSolarDraft,
    getSolarSystems,
    uploadImage,
  } = useOperatorApi();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [locations, setLocations] = useState<SolarLocation[]>([
    {
      id: 1,
      tehsil: "",
      village: "",
      settlement: "",
      hasGreenMeter: true,
      solarPanelCapacity: null,
      energyConsumed: "",
      energyExported: "",
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
  const [registeredSystems, setRegisteredSystems] = useState<
    RegisteredSolarSystem[]
  >([]);
  const [attachment, setAttachment] = useState<File | null>(null);
  const steps = [
    { id: 1, label: "Period", hint: "Choose reporting month and year" },
    {
      id: 2,
      label: "Locations",
      hint: "Enter per-site generation and import/export",
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
        const systems = await getSolarSystems();
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
      const draftData = (await getSolarDraft(draftId)) as SolarDraft | null;
      if (draftData) {
        setYear(draftData.year);
        setMonth(draftData.month);
        setLocations([
          {
            id: 1,
            tehsil: draftData.tehsil || "",
            village: draftData.village || "",
            settlement: draftData.settlement || "",
            hasGreenMeter: true,
            solarPanelCapacity: null,
            energyConsumed: draftData.energy_consumed_from_grid || "",
            energyExported: draftData.energy_exported_to_grid || "",
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
      const systems = (await getSolarSystems()) as RegisteredSolarSystem[];
      const system = systems.find((s) => String(s.id) === String(systemId));
      if (system) {
        setPrefilledSystemId(String(systemId));
        setLocations([
          {
            id: 1,
            tehsil: system.tehsil || "",
            village: system.village || "",
            settlement: system.settlement || "",
            hasGreenMeter: true,
            solarPanelCapacity: null,
            energyConsumed: "",
            energyExported: "",
          },
        ]);
        setStep(2);
      } else {
        setToast({
          message: "Selected plant could not be found.",
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

  const addLocation = () => {
    const newId =
      locations.length > 0 ? Math.max(...locations.map((l) => l.id)) + 1 : 1;
    setLocations([
      ...locations,
      {
        id: newId,
        tehsil: "",
        village: "",
        settlement: "",
        hasGreenMeter: true,
        solarPanelCapacity: null,
        energyConsumed: "",
        energyExported: "",
      },
    ]);
    setExpandedLocation(locations.length);
  };

  const removeLocation = (id: number) => {
    if (locations.length > 1) {
      setLocations(locations.filter((l) => l.id !== id));
      setExpandedLocation(0);
    }
  };

  const updateLocationValue = (
    id: number,
    field: keyof SolarLocation,
    value: SolarLocation[keyof SolarLocation],
  ) => {
    setLocations(
      locations.map((l) => (l.id === id ? { ...l, [field]: value } : l)),
    );
  };

  const handleLocationChange = async (
    id: number,
    field: keyof SolarLocation | "tehsil" | "village" | "settlement",
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
        solarPanelCapacity: null,
        energyConsumed: "",
        energyExported: "",
      };
    } else if (field === "village") {
      newLocations[idx] = {
        ...newLocations[idx]!,
        village: value,
        settlement: "",
        solarPanelCapacity: null,
        energyConsumed: "",
        energyExported: "",
      };
    } else if (field === "settlement") {
      newLocations[idx] = {
        ...newLocations[idx]!,
        settlement: value,
        energyConsumed: "",
        energyExported: "",
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
        const config = await getSolarSystemConfig(
          newTehsil,
          newVillage,
          newSettlement || "",
        );
        if (config.exists && config.config) {
          newLocations[idx]!.solarPanelCapacity =
            config.config.solar_panel_capacity || null;
        }
        const data = (await getSolarSupplyData({
          tehsil: newTehsil,
          village: newVillage,
          settlement: newSettlement || "",
          year,
        })) as SolarSupplyRecord[];
        if (data && data.length > 0) {
          const monthData = data.find(
            (d: SolarSupplyRecord) => d.month === month,
          );
          if (monthData) {
            newLocations[idx]!.energyConsumed =
              monthData.energy_consumed_from_grid || "";
            newLocations[idx]!.energyExported =
              monthData.energy_exported_to_grid || "";
          }
        }
        setLocations([...newLocations]);
      } catch (err: unknown) {
        setToast({
          message: getApiErrorMessage(err, "Could not load solar supply data"),
          type: "error",
        });
      }
    }
  };

  const submitData = async (status: SubmissionStatus) => {
    setLoading(true);
    try {
      let imagePath = null;
      if (attachment) {
        const uploadRes = await uploadImage(attachment, "temp", "solar");
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
              energy_consumed_from_grid: loc.energyConsumed || null,
              energy_exported_to_grid: loc.energyExported || null,
            },
          ],
        })),
        year: year,
        status: status,
        image_url: imagePath,
        image_path: imagePath,
      };

      await saveSolarSupplyData(payload);
      setToast({
        message: status === "draft" ? " Progress saved!" : "✅ Data submitted!",
        type: "success",
      });
      if (status === "submitted")
        setTimeout(() => navigate("/operator/solar-submissions"), 1500);
    } catch (err: unknown) {
      setToast({
        message: getApiErrorMessage(err, "Error occurred"),
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const totalConsumed = locations.reduce(
    (sum, l) => sum + (parseFloat(l.energyConsumed) || 0),
    0,
  );
  const totalExported = locations.reduce(
    (sum, l) => sum + (parseFloat(l.energyExported) || 0),
    0,
  );

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
            <Sun size={32} color="white" />
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
              Solar Energy Entry
            </h1>
            <p style={{ color: "#64748b", fontSize: "16px", marginTop: "4px" }}>
              Monitoring grid exchange and generation metrics
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
                color: "#f59e0b",
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
                <Calendar size={24} color="#f59e0b" />
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
                    <SelectTrigger className="h-12 w-full rounded-xl border-slate-200 bg-white text-sm font-semibold text-slate-700">
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {[currentYear, currentYear - 1, currentYear - 2].map(
                        (y) => (
                          <SelectItem key={y} value={String(y)}>
                            {y}
                          </SelectItem>
                        ),
                      )}
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
                          disabled={
                            year === currentYear && m.num > currentMonth
                          }
                        >
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div style={infoBoxStyle}>
                <Info size={20} color="#f59e0b" />
                <p
                  style={{
                    margin: 0,
                    color: "#334155",
                    fontSize: "14px",
                    lineHeight: "1.6",
                  }}
                >
                  Please ensure you have the net metering bill ready for the
                  selected month. Accurate reporting of grid import/export is
                  critical for carbon offset credits.
                </p>
              </div>

              <Button
                onClick={() => attemptStepChange(2)}
                className="mt-8 h-11 gap-2 bg-amber-500 text-white hover:bg-amber-600"
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
              <div style={{ display: "flex", gap: "12px" }}>
                <Button
                  variant="outline"
                  className="h-10 gap-2"
                  onClick={addLocation}
                >
                  <Plus size={18} /> Add Solar Site
                </Button>
              </div>
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
                            expandedLocation === idx ? "#f59e0b" : "#f1f5f9",
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
                            : "Select solar installation location"}
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
                      <div style={{ display: "flex", gap: "8px" }}>
                        {loc.energyConsumed && (
                          <div
                            style={{
                              ...valueBadgeStyle,
                              background: "#fff7ed",
                              color: "#ea580c",
                            }}
                          >
                            {loc.energyConsumed} kWh ↓
                          </div>
                        )}
                        {loc.energyExported && (
                          <div
                            style={{
                              ...valueBadgeStyle,
                              background: "#f0fdf4",
                              color: "#16a34a",
                            }}
                          >
                            {loc.energyExported} kWh ↑
                          </div>
                        )}
                      </div>
                      {locations.length > 1 && (
                        <Trash2
                          size={20}
                          color="#94a3b8"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeLocation(loc.id);
                          }}
                        />
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
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            marginBottom: "24px",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={loc.hasGreenMeter}
                            onChange={() =>
                              updateLocationValue(
                                loc.id,
                                "hasGreenMeter",
                                !loc.hasGreenMeter,
                              )
                            }
                            style={{
                              width: "20px",
                              height: "20px",
                              accentColor: "#f59e0b",
                            }}
                          />
                          <span style={{ fontWeight: "700", color: "#334155" }}>
                            Green Meter (Net Metering) Installed
                          </span>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "32px",
                          }}
                        >
                          <div style={inputGroupStyle}>
                            <label style={labelStyle}>
                              Energy Consumed (Import) kWh
                            </label>
                            <input
                              type="number"
                              style={inputStyle}
                              value={loc.energyConsumed}
                              onChange={(e) =>
                                updateLocationValue(
                                  loc.id,
                                  "energyConsumed",
                                  e.target.value,
                                )
                              }
                              placeholder="0.0"
                            />
                          </div>
                          <div style={inputGroupStyle}>
                            <label style={labelStyle}>
                              Energy Exported (kWh)
                            </label>
                            <input
                              type="number"
                              style={{
                                ...inputStyle,
                                fontWeight: "800",
                                color: "#16a34a",
                              }}
                              value={loc.energyExported}
                              onChange={(e) =>
                                updateLocationValue(
                                  loc.id,
                                  "energyExported",
                                  e.target.value,
                                )
                              }
                              disabled={!loc.hasGreenMeter}
                              placeholder={
                                loc.hasGreenMeter
                                  ? "0.0"
                                  : "Disabled (No Green Meter)"
                              }
                            />
                          </div>
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
                gridTemplateColumns: "1fr 400px",
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
                    <Camera size={24} color="#f59e0b" /> Net Metering Evidence
                  </h3>
                  <div
                    style={{
                      border: "2px dashed #e2e8f0",
                      borderRadius: "20px",
                      padding: "40px",
                      textAlign: "center",
                      cursor: "pointer",
                      background: attachment ? "#fffbeb" : "transparent",
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
                        <Zap
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
                          Upload Electricity Bill Photograph
                        </p>
                        <p
                          style={{
                            fontSize: "13px",
                            color: "#94a3b8",
                            marginTop: "4px",
                          }}
                        >
                          Include both generation & grid units
                        </p>
                      </>
                    ) : (
                      <>
                        <CheckCircle2
                          size={48}
                          color="#f59e0b"
                          style={{ margin: "0 auto 16px auto" }}
                        />
                        <p
                          style={{
                            fontWeight: "700",
                            color: "#92400e",
                            margin: 0,
                          }}
                        >
                          {attachment.name}
                        </p>
                        <p
                          style={{
                            fontSize: "13px",
                            color: "#b45309",
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
                  background: "linear-gradient(135deg, #1e293b, #0f172a)",
                  border: "none",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "24px",
                  }}
                >
                  <div>
                    <div
                      style={{
                        color: "rgba(255,255,255,0.6)",
                        fontSize: "12px",
                        fontWeight: "700",
                        textTransform: "uppercase",
                      }}
                    >
                      Total Import
                    </div>
                    <div
                      style={{
                        color: "white",
                        fontSize: "24px",
                        fontWeight: "900",
                      }}
                    >
                      {totalConsumed.toFixed(1)}{" "}
                      <span
                        style={{
                          fontSize: "14px",
                          color: "rgba(255,255,255,0.4)",
                        }}
                      >
                        kWh
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        color: "rgba(255,255,255,0.6)",
                        fontSize: "12px",
                        fontWeight: "700",
                        textTransform: "uppercase",
                      }}
                    >
                      Total Export
                    </div>
                    <div
                      style={{
                        color: "#10b981",
                        fontSize: "24px",
                        fontWeight: "900",
                      }}
                    >
                      {totalExported.toFixed(1)}{" "}
                      <span
                        style={{
                          fontSize: "14px",
                          color: "rgba(255,255,255,0.4)",
                        }}
                      >
                        kWh
                      </span>
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    height: "1px",
                    background: "rgba(255,255,255,0.1)",
                    marginBottom: "24px",
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
                    <Send size={18} /> Submit Period Data
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={saveButtonStyle}
                    onClick={() => submitData("draft")}
                    disabled={loading}
                  >
                    <Save size={18} /> Save Progress
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

// Styles
const iconBoxStyle = {
  width: "64px",
  height: "64px",
  borderRadius: "20px",
  background: "linear-gradient(135deg, #f59e0b, #d97706)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 10px 15px -3px rgba(245, 158, 11, 0.4)",
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
  background: "#fffbeb",
  borderRadius: "18px",
  border: "1px solid #fde68a",
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
  background: "#f59e0b",
  padding: "10px 20px",
  borderRadius: "12px",
  border: "none",
  color: "white",
  fontSize: "14px",
  fontWeight: "700",
  cursor: "pointer",
  boxShadow: "0 4px 6px -1px rgba(245, 158, 11, 0.2)",
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
  borderRadius: "10px",
  fontWeight: "800",
  fontSize: "14px",
};
const submitButtonStyle = {
  padding: "16px",
  background: "#f59e0b",
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

export default SolarSupplyDataForm;
