import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  useNavigate,
  useSearchParams,
  useParams,
  useLocation,
} from "react-router-dom";
import { motion } from "framer-motion";
import { tehsilRoutes } from "../../../constants/routes";
import { useTehsilManagerOperatorApi } from "../../../hooks";
import { useAuth } from "../../../contexts/AuthContext";
import Toast from "../../../components/Toast";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../../components/ui/alert";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { Separator } from "../../../components/ui/separator";
import { getApiErrorMessage } from "../../../lib/api-error";
import {
  Sun,
  ArrowLeft,
  Send,
  MapPin,
  Camera,
  CheckCircle2,
  Zap,
  AlertCircle,
  Loader2,
  Calendar,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { TEHSIL_OPTIONS } from "../../../utils/locationData";

type RegisteredSolarSystem = {
  id: string | number;
  tehsil: string;
  village: string;
  settlement?: string | undefined;
  solar_panel_capacity?: number | null;
};

/** Map API / profile tehsil string to canonical `TEHSIL_OPTIONS` entry. */
function canonicalTehsil(raw: string): string | null {
  const t = raw.trim().toUpperCase();
  return (TEHSIL_OPTIONS as readonly string[]).find((o) => o === t) ?? null;
}

function formatSiteLabel(s: RegisteredSolarSystem): string {
  const parts = [s.village];
  if (s.settlement?.trim()) parts.push(s.settlement.trim());
  const loc = parts.join(" · ");
  const cap =
    s.solar_panel_capacity != null &&
    !Number.isNaN(Number(s.solar_panel_capacity))
      ? ` · ${s.solar_panel_capacity} kWp`
      : "";
  return `${loc}${cap}`;
}

type ToastType = "success" | "error";

type SolarSupplyRow = {
  id?: string;
  month: number;
  export_off_peak?: string | number | null;
  export_peak?: string | number | null;
  import_off_peak?: string | number | null;
  import_peak?: string | number | null;
  net_off_peak?: string | number | null;
  net_peak?: string | number | null;
  remarks?: string | null;
  electricity_bill_image_url?: string | null;
  updated_at?: string | null;
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

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const SolarSupplyDataForm = () => {
  const { user } = useAuth();
  const {
    getSolarSupplyData,
    saveSolarSupplyData,
    getSolarSystems,
    uploadImage,
    getSolarSupplyRecord,
    updateSolarSupplyRecord,
    deleteSolarSupplyRecord,
  } = useTehsilManagerOperatorApi();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { recordId: recordIdFromPath } = useParams<{ recordId?: string }>();
  /** Dedicated route: only POST new rows; never pre-fill or PUT an existing monthly log. */
  const isAddOnlyRoute =
    location.pathname === "/tehsil/solar-energy-data/add" ||
    location.pathname.endsWith("/solar-energy-data/add");
  const navigateBack = useCallback(() => {
    const from = (location.state as { from?: string } | null)?.from;
    if (typeof from === "string" && from.trim()) {
      navigate(from, { replace: true });
      return;
    }
    navigate(-1);
  }, [location.state, navigate]);
  const systemIdParam = searchParams.get("system");
  /** Path `/tehsil/solar-energy-data/:recordId` or legacy `?record=` */
  const recordIdParam = recordIdFromPath ?? searchParams.get("record");
  const isDedicatedRecordEdit = Boolean(recordIdFromPath);

  const [registeredSystems, setRegisteredSystems] = useState<
    RegisteredSolarSystem[]
  >([]);
  const [selectedSystemId, setSelectedSystemId] = useState<string>("");
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [exportOffPeak, setExportOffPeak] = useState("");
  const [exportPeak, setExportPeak] = useState("");
  const [importOffPeak, setImportOffPeak] = useState("");
  const [importPeak, setImportPeak] = useState("");
  const [netOffPeak, setNetOffPeak] = useState("");
  const [netPeak, setNetPeak] = useState("");
  const [remarks, setRemarks] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [existingEvidenceUrl, setExistingEvidenceUrl] = useState<string | null>(
    null,
  );
  const [recordUpdatedAt, setRecordUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSystems, setLoadingSystems] = useState(true);
  /** When path has `:recordId`, site/period come from GET record (no list dependency). */
  const [pinnedSystemFromRecord, setPinnedSystemFromRecord] =
    useState<RegisteredSolarSystem | null>(null);
  const [recordLoadError, setRecordLoadError] = useState<string | null>(null);
  const [loadingDedicatedRecord, setLoadingDedicatedRecord] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType }>({
    message: "",
    type: "success",
  });

  const skipNextPrefillRef = useRef(false);
  const recordDeepLinkHandledRef = useRef(false);
  /** Add-only flow: preloaded monthly list for (system, year) to block duplicates. */
  const [existingMonthlyByMonth, setExistingMonthlyByMonth] = useState<
    Record<number, string>
  >({});
  const [loadingExistingForAdd, setLoadingExistingForAdd] = useState(false);

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

  const scopedRegisteredSystems = useMemo(() => {
    if (!hasResolvedProfileTehsils) return registeredSystems;
    const allowed = new Set(tehsilSelectOptions);
    return registeredSystems.filter((s) => {
      const c = canonicalTehsil(s.tehsil);
      return c !== null && allowed.has(c);
    });
  }, [registeredSystems, hasResolvedProfileTehsils, tehsilSelectOptions]);

  const tehsilScopeLabel = hasResolvedProfileTehsils
    ? tehsilSelectOptions.length === 1
      ? tehsilSelectOptions[0]
      : tehsilSelectOptions.join(" · ")
    : null;

  const selectedSystem = useMemo(() => {
    const fromList = scopedRegisteredSystems.find(
      (s) => String(s.id) === selectedSystemId,
    );
    if (fromList) return fromList;
    if (
      pinnedSystemFromRecord &&
      String(pinnedSystemFromRecord.id) === selectedSystemId
    ) {
      return pinnedSystemFromRecord;
    }
    return null;
  }, [scopedRegisteredSystems, selectedSystemId, pinnedSystemFromRecord]);

  const noSitesInScope =
    !isDedicatedRecordEdit && scopedRegisteredSystems.length === 0;

  /** Add-only route: load existing months once per (site, year). */
  useEffect(() => {
    if (!isAddOnlyRoute) return;
    if (!selectedSystem) {
      setExistingMonthlyByMonth({});
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingExistingForAdd(true);
      try {
        const data = (await getSolarSupplyData({
          tehsil: selectedSystem.tehsil,
          village: selectedSystem.village,
          settlement: selectedSystem.settlement || "",
          year,
        })) as SolarSupplyRow[];
        if (cancelled) return;
        const map: Record<number, string> = {};
        for (const row of Array.isArray(data) ? data : []) {
          const m = Number(row.month);
          const id = row.id ? String(row.id) : "";
          if (m >= 1 && m <= 12 && id) map[m] = id;
        }
        setExistingMonthlyByMonth(map);
      } catch {
        // If list load fails, do not block add — server will still validate.
        if (!cancelled) setExistingMonthlyByMonth({});
      } finally {
        if (!cancelled) setLoadingExistingForAdd(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAddOnlyRoute, selectedSystem, year, getSolarSupplyData]);

  const existingRecordIdForMonth = isAddOnlyRoute
    ? (existingMonthlyByMonth[month] ?? null)
    : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingSystems(true);
        const systems = await getSolarSystems({});
        if (!cancelled)
          setRegisteredSystems(systems as RegisteredSolarSystem[]);
      } catch (err: unknown) {
        if (!cancelled)
          setToast({
            message: getApiErrorMessage(err, "Failed to load solar sites"),
            type: "error",
          });
      } finally {
        if (!cancelled) setLoadingSystems(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getSolarSystems]);

  useEffect(() => {
    if (!systemIdParam || scopedRegisteredSystems.length === 0) return;
    const found = scopedRegisteredSystems.some(
      (s) => String(s.id) === systemIdParam,
    );
    if (found) setSelectedSystemId(systemIdParam);
  }, [systemIdParam, scopedRegisteredSystems]);

  useEffect(() => {
    if (!recordIdFromPath) {
      setPinnedSystemFromRecord(null);
      setRecordLoadError(null);
      recordDeepLinkHandledRef.current = false;
    }
  }, [recordIdFromPath]);

  const applyRecordPayload = useCallback(
    (
      rec: {
        id?: string;
        solar_system_id?: string;
        year?: number;
        month?: number;
        export_off_peak?: number | string | null;
        export_peak?: number | string | null;
        import_off_peak?: number | string | null;
        import_peak?: number | string | null;
        net_off_peak?: number | string | null;
        net_peak?: number | string | null;
        remarks?: string | null;
        electricity_bill_image_url?: string | null;
        updated_at?: string | null;
      },
      recordKey: string,
    ) => {
      recordDeepLinkHandledRef.current = true;
      skipNextPrefillRef.current = true;
      setSelectedSystemId(String(rec.solar_system_id));
      if (rec.year != null) setYear(rec.year);
      if (rec.month != null) setMonth(rec.month);
      setEditingRecordId(String(rec.id ?? recordKey));
      setExistingEvidenceUrl(
        rec.electricity_bill_image_url?.trim()
          ? String(rec.electricity_bill_image_url)
          : null,
      );
      setRecordUpdatedAt(rec.updated_at ?? null);
      setExportOffPeak(
        rec.export_off_peak != null && String(rec.export_off_peak) !== ""
          ? String(rec.export_off_peak)
          : "",
      );
      setExportPeak(
        rec.export_peak != null && String(rec.export_peak) !== ""
          ? String(rec.export_peak)
          : "",
      );
      setImportOffPeak(
        rec.import_off_peak != null && String(rec.import_off_peak) !== ""
          ? String(rec.import_off_peak)
          : "",
      );
      setImportPeak(
        rec.import_peak != null && String(rec.import_peak) !== ""
          ? String(rec.import_peak)
          : "",
      );
      setNetOffPeak(
        rec.net_off_peak != null && String(rec.net_off_peak) !== ""
          ? String(rec.net_off_peak)
          : "",
      );
      setNetPeak(
        rec.net_peak != null && String(rec.net_peak) !== ""
          ? String(rec.net_peak)
          : "",
      );
      setRemarks(rec.remarks?.trim() ? String(rec.remarks) : "");
      setAttachment(null);
    },
    [],
  );

  /** `/tehsil/solar-energy-data/:recordId` — load by id without waiting for sites list. */
  useEffect(() => {
    if (!recordIdFromPath) return;
    let cancelled = false;
    setRecordLoadError(null);
    setPinnedSystemFromRecord(null);
    (async () => {
      setLoadingDedicatedRecord(true);
      try {
        const rec = (await getSolarSupplyRecord(recordIdFromPath)) as {
          id?: string;
          solar_system_id?: string;
          tehsil?: string;
          village?: string;
          settlement?: string;
          year?: number;
          month?: number;
          export_off_peak?: number | string | null;
          export_peak?: number | string | null;
          import_off_peak?: number | string | null;
          import_peak?: number | string | null;
          net_off_peak?: number | string | null;
          net_peak?: number | string | null;
          remarks?: string | null;
          electricity_bill_image_url?: string | null;
          updated_at?: string | null;
        };
        if (!rec || cancelled) return;

        if (hasResolvedProfileTehsils) {
          const c = canonicalTehsil(String(rec.tehsil ?? ""));
          const allowed = new Set(tehsilSelectOptions);
          if (!c || !allowed.has(c)) {
            setRecordLoadError("This record belongs to another tehsil.");
            setPinnedSystemFromRecord(null);
            return;
          }
        }

        setPinnedSystemFromRecord({
          id: String(rec.solar_system_id),
          tehsil: String(rec.tehsil ?? ""),
          village: String(rec.village ?? ""),
          settlement: (rec.settlement ?? "").trim() || undefined,
          solar_panel_capacity: null,
        });
        applyRecordPayload(rec, recordIdFromPath);
      } catch (e: unknown) {
        if (!cancelled)
          setRecordLoadError(
            getApiErrorMessage(e, "Failed to load monthly record"),
          );
      } finally {
        if (!cancelled) setLoadingDedicatedRecord(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    recordIdFromPath,
    getSolarSupplyRecord,
    hasResolvedProfileTehsils,
    tehsilSelectOptions,
    applyRecordPayload,
  ]);

  /** `?record=` deep link — needs sites list to resolve the solar system row. */
  useEffect(() => {
    if (recordIdFromPath) return;
    if (!recordIdParam || registeredSystems.length === 0) return;
    if (recordDeepLinkHandledRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        const rec = (await getSolarSupplyRecord(recordIdParam)) as {
          id?: string;
          solar_system_id?: string;
          year?: number;
          month?: number;
          export_off_peak?: number | string | null;
          export_peak?: number | string | null;
          import_off_peak?: number | string | null;
          import_peak?: number | string | null;
          net_off_peak?: number | string | null;
          net_peak?: number | string | null;
          remarks?: string | null;
          electricity_bill_image_url?: string | null;
          updated_at?: string | null;
        };
        if (!rec || cancelled) return;

        const sys = registeredSystems.find(
          (s) => String(s.id) === String(rec.solar_system_id),
        );
        if (!sys) {
          setToast({
            message: "Solar site for this record was not found in your list.",
            type: "error",
          });
          return;
        }

        if (hasResolvedProfileTehsils) {
          const c = canonicalTehsil(sys.tehsil);
          const allowed = new Set(tehsilSelectOptions);
          if (!c || !allowed.has(c)) {
            setToast({
              message: "This record belongs to another tehsil.",
              type: "error",
            });
            return;
          }
        }

        applyRecordPayload(rec, recordIdParam);
      } catch (e: unknown) {
        if (!cancelled)
          setToast({
            message: getApiErrorMessage(e, "Failed to load monthly record"),
            type: "error",
          });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    recordIdFromPath,
    recordIdParam,
    registeredSystems,
    getSolarSupplyRecord,
    hasResolvedProfileTehsils,
    tehsilSelectOptions,
    applyRecordPayload,
  ]);

  useEffect(() => {
    if (recordIdFromPath) return;
    if (isAddOnlyRoute) return;
    if (!selectedSystem) return;
    if (skipNextPrefillRef.current) {
      skipNextPrefillRef.current = false;
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const data = (await getSolarSupplyData({
          tehsil: selectedSystem.tehsil,
          village: selectedSystem.village,
          settlement: selectedSystem.settlement || "",
          year,
        })) as SolarSupplyRow[];
        if (cancelled) return;
        const row = data.find((d) => d.month === month);
        if (row) {
          setEditingRecordId(row.id ? String(row.id) : null);
          setExistingEvidenceUrl(
            row.electricity_bill_image_url?.trim()
              ? String(row.electricity_bill_image_url)
              : null,
          );
          setRecordUpdatedAt(row.updated_at ?? null);
          setExportOffPeak(
            row.export_off_peak != null && String(row.export_off_peak) !== ""
              ? String(row.export_off_peak)
              : "",
          );
          setExportPeak(
            row.export_peak != null && String(row.export_peak) !== ""
              ? String(row.export_peak)
              : "",
          );
          setImportOffPeak(
            row.import_off_peak != null && String(row.import_off_peak) !== ""
              ? String(row.import_off_peak)
              : "",
          );
          setImportPeak(
            row.import_peak != null && String(row.import_peak) !== ""
              ? String(row.import_peak)
              : "",
          );
          setNetOffPeak(
            row.net_off_peak != null && String(row.net_off_peak) !== ""
              ? String(row.net_off_peak)
              : "",
          );
          setNetPeak(
            row.net_peak != null && String(row.net_peak) !== ""
              ? String(row.net_peak)
              : "",
          );
          setRemarks(row.remarks?.trim() ? String(row.remarks) : "");
        } else {
          setEditingRecordId(null);
          setExistingEvidenceUrl(null);
          setRecordUpdatedAt(null);
          setExportOffPeak("");
          setExportPeak("");
          setImportOffPeak("");
          setImportPeak("");
          setNetOffPeak("");
          setNetPeak("");
          setRemarks("");
        }
        setAttachment(null);
      } catch {
        /* keep current fields */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    recordIdFromPath,
    isAddOnlyRoute,
    selectedSystem,
    selectedSystemId,
    year,
    month,
    getSolarSupplyData,
  ]);

  const applyRowFromList = async () => {
    if (!selectedSystem) return;
    try {
      const data = (await getSolarSupplyData({
        tehsil: selectedSystem.tehsil,
        village: selectedSystem.village,
        settlement: selectedSystem.settlement || "",
        year,
      })) as SolarSupplyRow[];
      const row = data.find((d) => d.month === month);
      if (row) {
        setEditingRecordId(row.id ? String(row.id) : null);
        setExistingEvidenceUrl(
          row.electricity_bill_image_url?.trim()
            ? String(row.electricity_bill_image_url)
            : null,
        );
        setRecordUpdatedAt(row.updated_at ?? null);
      }
    } catch {
      /* ignore */
    }
  };

  const save = async () => {
    if (!selectedSystem) {
      setToast({ message: "Select a solar site.", type: "error" });
      return;
    }
    if (isAddOnlyRoute && existingRecordIdForMonth) {
      setToast({
        message:
          "A monthly log already exists for this site, year, and month. Open it from Solar Monthly Logging to edit.",
        type: "error",
      });
      return;
    }
    const values = [
      exportOffPeak,
      exportPeak,
      importOffPeak,
      importPeak,
      netOffPeak,
      netPeak,
    ];
    const nums = values.map((v) => parseFloat(v));
    if (
      values.some((v) => v.trim() === "") ||
      nums.some((n) => Number.isNaN(n))
    ) {
      setToast({
        message:
          "Enter Import/Export/Net values (Peak & Off-Peak) in kWh (numbers; 0 is allowed).",
        type: "error",
      });
      return;
    }

    setLoading(true);
    try {
      let imagePath: string | null = null;
      if (attachment) {
        const uploadRes = await uploadImage(
          attachment,
          "solar",
          isAddOnlyRoute ? undefined : (editingRecordId ?? undefined),
        );
        const raw = uploadRes.image_url ?? uploadRes.path;
        imagePath = typeof raw === "string" ? raw : null;
      }

      if (isAddOnlyRoute) {
        await saveSolarSupplyData({
          data: [
            {
              tehsil: selectedSystem.tehsil,
              village: selectedSystem.village,
              settlement: selectedSystem.settlement || "",
              monthlyData: [
                {
                  month,
                  export_off_peak: exportOffPeak,
                  export_peak: exportPeak,
                  import_off_peak: importOffPeak,
                  import_peak: importPeak,
                  net_off_peak: netOffPeak,
                  net_peak: netPeak,
                  remarks: remarks.trim() || null,
                },
              ],
            },
          ],
          year,
          image_url: imagePath,
          image_path: imagePath,
        });
        setToast({ message: "Monthly log saved.", type: "success" });
        setAttachment(null);
        setEditingRecordId(null);
        setExistingEvidenceUrl(null);
        setRecordUpdatedAt(null);
        setExportOffPeak("");
        setExportPeak("");
        setImportOffPeak("");
        setImportPeak("");
        setNetOffPeak("");
        setNetPeak("");
        setRemarks("");
        navigateBack();
        return;
      }

      if (editingRecordId) {
        const payload: Record<string, unknown> = {
          export_off_peak: exportOffPeak,
          export_peak: exportPeak,
          import_off_peak: importOffPeak,
          import_peak: importPeak,
          net_off_peak: netOffPeak,
          net_peak: netPeak,
          remarks: remarks.trim() || null,
        };
        if (imagePath) {
          payload.image_url = imagePath;
          payload.image_path = imagePath;
        }
        const res = (await updateSolarSupplyRecord(
          editingRecordId,
          payload,
        )) as {
          updated_at?: string;
        };
        if (res?.updated_at) setRecordUpdatedAt(res.updated_at);
        setToast({ message: "Monthly log saved.", type: "success" });
        setAttachment(null);
        if (recordIdFromPath) {
          navigateBack();
          return;
        }
        await applyRowFromList();
      } else {
        await saveSolarSupplyData({
          data: [
            {
              tehsil: selectedSystem.tehsil,
              village: selectedSystem.village,
              settlement: selectedSystem.settlement || "",
              monthlyData: [
                {
                  month,
                  export_off_peak: exportOffPeak,
                  export_peak: exportPeak,
                  import_off_peak: importOffPeak,
                  import_peak: importPeak,
                  net_off_peak: netOffPeak,
                  net_peak: netPeak,
                  remarks: remarks.trim() || null,
                },
              ],
            },
          ],
          year,
          image_url: imagePath,
          image_path: imagePath,
        });
        setToast({ message: "Monthly log saved.", type: "success" });
        setAttachment(null);
        await applyRowFromList();
      }
    } catch (err: unknown) {
      setToast({
        message: getApiErrorMessage(err, "Save failed"),
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const removeMonthlyRecord = async () => {
    if (!editingRecordId) return;
    if (
      !window.confirm(
        "Delete this monthly log for the selected site and period? This cannot be undone.",
      )
    )
      return;
    setLoading(true);
    try {
      await deleteSolarSupplyRecord(editingRecordId);
      setToast({ message: "Monthly log deleted.", type: "success" });
      if (recordIdFromPath) {
        navigate(tehsilRoutes.solarMonthlyLogging);
        return;
      }
      setEditingRecordId(null);
      setExistingEvidenceUrl(null);
      setRecordUpdatedAt(null);
      setExportOffPeak("");
      setExportPeak("");
      setImportOffPeak("");
      setImportPeak("");
      setNetOffPeak("");
      setNetPeak("");
      setRemarks("");
      setAttachment(null);
    } catch (err: unknown) {
      setToast({
        message: getApiErrorMessage(err, "Delete failed"),
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const isEditingExisting = Boolean(editingRecordId);

  const monthLabel =
    MONTHS.find((m) => m.num === month)?.name ?? `Month ${month}`;

  const showSystemsSpinner = loadingSystems && !isDedicatedRecordEdit;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-muted/30 p-4 pb-16 md:p-6"
    >
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: "", type: "success" })}
      />

      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-6 flex items-start gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="size-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                {isDedicatedRecordEdit
                  ? "Edit monthly solar log"
                  : isAddOnlyRoute
                    ? "Add monthly solar log"
                    : "Monthly solar energy log"}
              </h1>
              {tehsilScopeLabel ? (
                <Badge variant="outline" className="gap-1">
                  <MapPin className="size-3.5" />
                  {tehsilScopeLabel}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {isDedicatedRecordEdit
                ? "Update import, export, and evidence for this month."
                : isAddOnlyRoute
                  ? "Enter a new monthly reading for a registered site. To change an existing month, use Solar Monthly Logging → Edit."
                  : "Log grid import/export for a registered site (no draft/verification on this screen)."}
            </p>
          </div>
        </div>

        {isDedicatedRecordEdit && loadingDedicatedRecord ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-10 animate-spin text-amber-500" />
          </div>
        ) : isDedicatedRecordEdit && recordLoadError ? (
          <Card className="rounded-2xl border-rose-200 bg-rose-50/50">
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <AlertCircle className="size-12 text-rose-600" />
              <p className="text-base font-semibold text-slate-900">
                Could not load this log
              </p>
              <p className="max-w-md text-sm text-slate-600">
                {recordLoadError}
              </p>
              <Button
                variant="outline"
                onClick={() => navigate(tehsilRoutes.solarMonthlyLogging)}
              >
                Back to Solar Monthly Logging
              </Button>
            </CardContent>
          </Card>
        ) : showSystemsSpinner ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-10 animate-spin text-amber-500" />
          </div>
        ) : noSitesInScope ? (
          <Card className="border-dashed border-slate-300">
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <AlertCircle className="size-12 text-amber-500" />
              <p className="text-base font-semibold text-slate-800">
                {hasResolvedProfileTehsils
                  ? "No solar sites in your tehsil yet"
                  : "No registered solar sites"}
              </p>
              <p className="text-sm text-slate-600">
                Register a site first, then log grid import and export here.
              </p>
              <Button onClick={() => navigate(tehsilRoutes.solarForm)}>
                Register solar site
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-base">Entry</CardTitle>
              <CardDescription>
                Select site and period, then enter energy values and upload
                evidence.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isAddOnlyRoute ? (
                loadingExistingForAdd ? (
                  <Alert>
                    <Loader2 className="size-4 animate-spin" />
                    <AlertTitle>Checking existing logs…</AlertTitle>
                    <AlertDescription>
                      Validating whether this month already exists for the
                      selected site and year.
                    </AlertDescription>
                  </Alert>
                ) : existingRecordIdForMonth ? (
                  <Alert variant="destructive">
                    <AlertCircle className="size-4" />
                    <AlertTitle>Duplicate month blocked</AlertTitle>
                    <AlertDescription>
                      A log for <strong>{monthLabel}</strong>{" "}
                      <strong>{year}</strong> already exists for this site.
                      Editing is only available from{" "}
                      <strong>Solar Monthly Logging</strong>.
                      <br />
                      <button
                        type="button"
                        className="mt-2 text-sm font-semibold underline underline-offset-4"
                        onClick={() =>
                          navigate(
                            tehsilRoutes.solarMonthlyLogEdit(
                              existingRecordIdForMonth,
                            ),
                          )
                        }
                      >
                        Open existing record
                      </button>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert>
                    <Zap className="size-4" />
                    <AlertTitle>Add mode</AlertTitle>
                    <AlertDescription>
                      This screen will only create a new log. Existing logs
                      can’t be edited here.
                    </AlertDescription>
                  </Alert>
                )
              ) : null}

              {isDedicatedRecordEdit && selectedSystem ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm">
                  <p className="font-semibold text-slate-900">
                    {formatSiteLabel(selectedSystem)}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="size-3.5 text-slate-400" />
                      {year} · {monthLabel}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-xs uppercase tracking-wide text-slate-500">
                      {canonicalTehsil(selectedSystem.tehsil) ??
                        selectedSystem.tehsil}
                    </span>
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Solar site</Label>
                    <Select
                      value={selectedSystemId || "__none__"}
                      onValueChange={(v) => {
                        if (v == null || v === "__none__")
                          setSelectedSystemId("");
                        else setSelectedSystemId(v);
                      }}
                    >
                      <SelectTrigger className="h-11 w-full">
                        <SelectValue placeholder="Choose a site" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Choose a site…</SelectItem>
                        {scopedRegisteredSystems.map((s) => (
                          <SelectItem key={String(s.id)} value={String(s.id)}>
                            {formatSiteLabel(s)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">
                        <Calendar className="size-3.5 text-slate-400" />
                        Year
                      </Label>
                      <Select
                        value={String(year)}
                        onValueChange={(v) => v && setYear(Number(v))}
                      >
                        <SelectTrigger className="h-11 w-full">
                          <SelectValue />
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
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">
                        <Calendar className="size-3.5 text-slate-400" />
                        Month
                      </Label>
                      <Select
                        value={String(month)}
                        onValueChange={(v) => v && setMonth(Number(v))}
                      >
                        <SelectTrigger className="h-11 w-full">
                          <SelectValue />
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
                </>
              )}

              {recordUpdatedAt ? (
                <p className="text-xs text-slate-500">
                  Last updated:{" "}
                  <span className="font-medium text-slate-700">
                    {formatDateTime(recordUpdatedAt)}
                  </span>
                </p>
              ) : null}

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="export-off-peak">Export off-peak </Label>
                  <Input
                    id="export-off-peak"
                    type="number"
                    step="0.01"
                    className="h-11"
                    value={exportOffPeak}
                    onChange={(e) => setExportOffPeak(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="export-peak">Export peak </Label>
                  <Input
                    id="export-peak"
                    type="number"
                    step="0.01"
                    className="h-11"
                    value={exportPeak}
                    onChange={(e) => setExportPeak(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="import-off-peak">Import off-peak </Label>
                  <Input
                    id="import-off-peak"
                    type="number"
                    step="0.01"
                    className="h-11"
                    value={importOffPeak}
                    onChange={(e) => setImportOffPeak(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="import-peak">Import peak </Label>
                  <Input
                    id="import-peak"
                    type="number"
                    step="0.01"
                    className="h-11"
                    value={importPeak}
                    onChange={(e) => setImportPeak(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="net-off-peak">Net off-peak </Label>
                  <Input
                    id="net-off-peak"
                    type="number"
                    step="0.01"
                    className="h-11"
                    value={netOffPeak}
                    onChange={(e) => setNetOffPeak(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="net-peak">Net peak </Label>
                  <Input
                    id="net-peak"
                    type="number"
                    step="0.01"
                    className="h-11"
                    value={netPeak}
                    onChange={(e) => setNetPeak(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="remarks">Remarks</Label>
                  <Textarea
                    id="remarks"
                    className="min-h-20 resize-none"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Optional notes for this month"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Camera className="size-4 text-amber-600" />
                  Metering evidence
                </Label>
                {existingEvidenceUrl && !attachment ? (
                  <a
                    href={existingEvidenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 underline-offset-4 hover:underline"
                  >
                    <ExternalLink className="size-3.5" />
                    View current file
                  </a>
                ) : null}
                <button
                  type="button"
                  className="w-full rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center transition-colors hover:border-amber-300 hover:bg-amber-50/30"
                  onClick={() =>
                    document.getElementById("solar-evidence-input")?.click()
                  }
                >
                  <input
                    id="solar-evidence-input"
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
                  />
                  {!attachment ? (
                    <>
                      <Zap className="mx-auto mb-2 size-10 text-slate-300" />
                      <p className="text-sm font-medium text-slate-600">
                        Tap to upload or replace bill photo
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        PNG or JPG — replaces stored file when you save
                      </p>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mx-auto mb-2 size-10 text-amber-500" />
                      <p className="text-sm font-semibold text-slate-800">
                        {attachment.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Tap to choose a different file
                      </p>
                    </>
                  )}
                </button>
              </div>

              <Separator />

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  className="h-12 flex-1 gap-2"
                  disabled={
                    loading ||
                    !selectedSystemId ||
                    (isAddOnlyRoute && loadingExistingForAdd) ||
                    (isAddOnlyRoute && Boolean(existingRecordIdForMonth))
                  }
                  onClick={() => void save()}
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  {isEditingExisting ? "Save changes" : "Save monthly log"}
                </Button>
                {isEditingExisting ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 gap-2 border-rose-200 text-rose-700 hover:bg-rose-50"
                    disabled={loading}
                    onClick={() => void removeMonthlyRecord()}
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </motion.div>
  );
};

export default SolarSupplyDataForm;
