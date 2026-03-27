import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Toast from "../../components/Toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Skeleton } from "../../components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { useOperatorApi } from "../../hooks";
import { getApiErrorMessage } from "../../lib/api-error";
import { Droplets, Info, Calendar, Lightbulb, Download } from "lucide-react";

type ToastType = "success" | "error";

type WaterSystem = {
  id: number;
  tehsil: string;
  village: string;
  settlement?: string;
};

type WaterSystemConfig = {
  pump_flow_rate?: number;
};

type WaterRow = Record<string, unknown>;

type WaterRecord = {
  water_system_id: number;
  month: number;
  pump_operating_hours: number | null;
  total_water_pumped: number | null;
};

const MONTHS = [
  { key: "jan", label: "January", num: 1 },
  { key: "feb", label: "February", num: 2 },
  { key: "mar", label: "March", num: 3 },
  { key: "apr", label: "April", num: 4 },
  { key: "may", label: "May", num: 5 },
  { key: "jun", label: "June", num: 6 },
  { key: "jul", label: "July", num: 7 },
  { key: "aug", label: "August", num: 8 },
  { key: "sep", label: "September", num: 9 },
  { key: "oct", label: "October", num: 10 },
  { key: "nov", label: "November", num: 11 },
  { key: "dec", label: "December", num: 12 },
];

const currentYear = new Date().getFullYear();
const SmartTable = lazy(() => import("../../components/SmartTable"));

const rowsToRecords = (rows: WaterRow[], _year: number): WaterRecord[] => {
  const records: WaterRecord[] = [];
  rows.forEach((row) => {
    if (!row.water_system_id) return;
    MONTHS.forEach(({ key, num }) => {
      const hours = row[`${key}_hours`];
      const water = row[`${key}_water`];
      if (hours !== "" || water !== "") {
        records.push({
          water_system_id: Number(row.water_system_id),
          month: num,
          pump_operating_hours: hours === "" ? null : Number(hours),
          total_water_pumped: water === "" ? null : Number(water),
        });
      }
    });
  });
  return records;
};

const WaterDataTable = () => {
  const { downloadWaterReportPDF, getWaterSystems, saveWaterBulkData } =
    useOperatorApi();
  const navigate = useNavigate();
  const [waterSystems, setWaterSystems] = useState<WaterSystem[]>([]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [systemsLoading, setSystemsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType }>({
    message: "",
    type: "success",
  });
  const [systemConfigs] = useState<Record<number, WaterSystemConfig>>({});
  const [selectedPdfSystemId, setSelectedPdfSystemId] = useState<string>("");

  // Handle PDF download
  const handleDownloadPDF = async (systemId: string | number) => {
    try {
      await downloadWaterReportPDF(systemId, selectedYear);
      setToast({ message: "PDF downloaded successfully!", type: "success" });
    } catch (error) {
      setToast({ message: "Failed to download PDF", type: "error" });
    }
  };

  useEffect(() => {
    setSystemsLoading(true);
    getWaterSystems()
      .then((systems) => setWaterSystems((systems as WaterSystem[]) ?? []))
      .catch((error: unknown) =>
        setToast({
          message: getApiErrorMessage(error, "Failed to load water systems"),
          type: "error",
        }),
      )
      .finally(() => setSystemsLoading(false));
  }, [getWaterSystems]);

  const columns = [
    {
      accessorKey: "water_system_id",
      header: "System Location",
      required: true,
      type: "dropdown" as const,
      options: waterSystems.map((s) => String(s.id)),
      minWidth: "240px",
      cell: ({ getValue }: { getValue: () => unknown }) => {
        const valueId = Number(getValue() ?? 0);
        const system = waterSystems.find((s) => s.id === valueId);
        return system ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontWeight: "600", color: "#1e293b" }}>
              {system.tehsil} - {system.village}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                {system.settlement || "Main Settlement"}
              </span>
              {systemConfigs[valueId]?.pump_flow_rate && (
                <span
                  style={{
                    fontSize: "10px",
                    background: "#ecfdf5",
                    color: "#059669",
                    padding: "1px 6px",
                    borderRadius: "4px",
                    fontWeight: "bold",
                  }}
                >
                  {systemConfigs[valueId].pump_flow_rate} m³/h
                </span>
              )}
            </div>
          </div>
        ) : (
          <span style={{ color: "#94a3b8", fontStyle: "italic" }}>
            — Select Facility —
          </span>
        );
      },
    },
    ...MONTHS.flatMap(({ key, label }) => [
      {
        accessorKey: `${key}_hours`,
        header: `${label.slice(0, 3)} Hrs`,
        type: "number" as const,
        min: 0,
        max: 744,
        showTotal: true,
        minWidth: "95px",
      },
      {
        accessorKey: `${key}_water`,
        header: `${label.slice(0, 3)} m³`,
        type: "number" as const,
        min: 0,
        showTotal: true,
        minWidth: "95px",
      },
    ]),
    {
      accessorKey: "bulk_image",
      header: "Meter Photo",
      type: "image" as const,
      minWidth: "130px",
    },
  ];

  const submitData = async (
    rows: Array<Record<string, unknown>>,
    status: string,
  ) => {
    setLoading(true);
    try {
      const records = rowsToRecords(rows, selectedYear);
      if (!records.length) {
        setToast({ message: "No monthly data entries found.", type: "error" });
        setLoading(false);
        return;
      }

      const hasNegative = records.some(
        (r) =>
          (r.pump_operating_hours !== null && r.pump_operating_hours < 0) ||
          (r.total_water_pumped !== null && r.total_water_pumped < 0),
      );
      if (hasNegative) {
        setToast({
          message: "Negative values are not allowed.",
          type: "error",
        });
        setLoading(false);
        return;
      }

      const hasTooManyHours = records.some(
        (r) => (r.pump_operating_hours ?? 0) > 744,
      );
      if (hasTooManyHours) {
        setToast({
          message: "Hours cannot exceed 744 per month.",
          type: "error",
        });
        setLoading(false);
        return;
      }

      await saveWaterBulkData({
        rows: records,
        year: selectedYear,
        status,
      });

      setToast({
        message:
          status === "draft"
            ? " Draft saved successfully!"
            : "✅ Data submitted for review!",
        type: "success",
      });

      if (status === "submitted") {
        setTimeout(() => navigate("/operator/water-submissions"), 1500);
      }
    } catch (err: unknown) {
      setToast({
        message: getApiErrorMessage(err, "Transaction failed"),
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ padding: "32px", background: "#f8fafc", minHeight: "100vh" }}
    >
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: "", type: "success" })}
      />

      {/* Header Section */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "32px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              background: "linear-gradient(135deg, #3b82f6, #2563eb)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 16px -4px rgba(59, 130, 246, 0.3)",
            }}
          >
            <Droplets size={28} color="white" />
          </div>
          <div>
            <h1
              style={{
                fontSize: "28px",
                fontWeight: "800",
                color: "#0f172a",
                letterSpacing: "-0.02em",
                margin: 0,
              }}
            >
              Monthly Water Supply Logs
            </h1>
            <p
              style={{
                color: "#64748b",
                margin: "4px 0 0 0",
                fontSize: "15px",
              }}
            >
              Report operational hours and water volumes for verification
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ position: "relative" }}>
            <Calendar
              size={16}
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#64748b",
              }}
            />
            <Select
              value={String(selectedYear)}
              onValueChange={(nextValue) => {
                if (!nextValue) return;
                setSelectedYear(Number(nextValue));
              }}
            >
              <SelectTrigger className="h-11 w-[160px] border-slate-200 bg-white pl-9 text-sm font-semibold text-slate-800 shadow-sm">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent align="end">
                {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    Year {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Guidance Alert */}
      <div
        style={{
          marginBottom: "32px",
          padding: "24px",
          borderRadius: "20px",
          background: "white",
          border: "1px solid #fed7aa",
          borderLeft: "6px solid #f59e0b",
          boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ display: "flex", gap: "20px" }}>
          <div
            style={{
              padding: "10px",
              background: "#fff7ed",
              borderRadius: "12px",
              height: "fit-content",
            }}
          >
            <Info size={24} color="#f59e0b" />
          </div>
          <div>
            <h4
              style={{
                margin: "0 0 8px 0",
                color: "#9a3412",
                fontSize: "18px",
                fontWeight: "700",
              }}
            >
              Operator Data Entry Guide
            </h4>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "24px",
              }}
            >
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "20px",
                  color: "#431407",
                  fontSize: "14px",
                  lineHeight: "1.6",
                }}
              >
                <li>
                  <strong>With Meter:</strong> Enter "Total Water Pumped (m³)"
                  for each valid month.
                </li>
                <li>
                  <strong>No Meter:</strong> Enter "Pump Hours" — water will be
                  calculated via flow rate.
                </li>
              </ul>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "20px",
                  color: "#431407",
                  fontSize: "14px",
                  lineHeight: "1.6",
                }}
              >
                <li>
                  <strong>New Installation:</strong> Enter hours used before
                  meter + metered volume after.
                </li>
                <li>
                  <strong>Time Limit:</strong> Operating hours cannot exceed 744
                  per calendar month.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Interface */}
      <motion.div
        whileHover={{ y: -2 }}
        style={{
          background: "white",
          borderRadius: "24px",
          padding: "32px",
          boxShadow:
            "0 20px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05)",
          border: "1px solid #f1f5f9",
        }}
      >
        {systemsLoading ? (
          <TableGridSkeleton />
        ) : (
          <Suspense fallback={<TableGridSkeleton />}>
            <SmartTable
              title={`Operational Reporting Grid — ${selectedYear}`}
              columns={columns}
              year={selectedYear}
              onSaveDraft={(rows) => submitData(rows, "draft")}
              onSubmit={(rows) => submitData(rows, "submitted")}
              loading={loading}
              color="#3b82f6"
            />
          </Suspense>
        )}

        {/* PDF Download Section */}
        <div
          style={{
            marginTop: "24px",
            padding: "16px",
            background: "#f8fafc",
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h4
              style={{
                margin: "0 0 8px 0",
                color: "#1e293b",
                fontSize: "14px",
                fontWeight: "600",
              }}
            >
              Download Report
            </h4>
            <p style={{ margin: 0, color: "#64748b", fontSize: "12px" }}>
              Select a water system to download its monthly report as PDF
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <Select
              value={selectedPdfSystemId || "__empty__"}
              onValueChange={(nextValue) => {
                if (nextValue === null) return;
                setSelectedPdfSystemId(
                  nextValue === "__empty__" ? "" : nextValue,
                );
              }}
            >
              <SelectTrigger
                id="pdf-system-select"
                className="h-9 w-[220px] border-slate-200 bg-white text-sm"
              >
                <SelectValue placeholder="Select System" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="__empty__">Select System</SelectItem>
                {waterSystems.map((sys) => (
                  <SelectItem key={sys.id} value={String(sys.id)}>
                    {sys.tehsil} - {sys.village}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={() => {
                const sysId = selectedPdfSystemId;
                if (sysId) handleDownloadPDF(sysId);
                else
                  setToast({
                    message: "Please select a system",
                    type: "error",
                  });
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                background: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              <Download size={16} /> Download PDF
            </button>
          </div>
        </div>

        <div
          style={{
            marginTop: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid #f1f5f9",
            paddingTop: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "#64748b",
              fontSize: "14px",
            }}
          >
            <Lightbulb size={16} color="#3b82f6" />
            <span>
              Use{" "}
              <kbd
                style={{
                  background: "#f1f5f9",
                  padding: "2px 6px",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
              >
                Tab
              </kbd>{" "}
              to navigate. Changes are saved automatically in draft mode.
            </span>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <span style={{ fontSize: "13px", color: "#94a3b8" }}>
              * Ensure all required monthly cells are filled before submission.
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default WaterDataTable;

function TableGridSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Skeleton className="h-6 w-56" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            {Array.from({ length: 8 }).map((_, idx) => (
              <TableHead key={idx}>
                <Skeleton className="h-4 w-20" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 6 }).map((_, rowIdx) => (
            <TableRow key={rowIdx}>
              {Array.from({ length: 8 }).map((__, cellIdx) => (
                <TableCell key={cellIdx}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            {Array.from({ length: 8 }).map((_, idx) => (
              <TableCell key={idx}>
                <Skeleton className="h-5 w-16" />
              </TableCell>
            ))}
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
