import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Toast from "../../components/Toast";
import { Skeleton } from "../../components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
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
import { Sun, Calendar, Zap } from "lucide-react";

type ToastType = "success" | "error";

type SolarSystem = {
  id: number;
  tehsil: string;
  village: string;
  settlement?: string;
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

const rowsToRecords = (rows: any[], year: number) => {
  const records: any[] = [];
  rows.forEach((row: any) => {
    if (!row.solar_system_id) return;
    MONTHS.forEach(({ key, num }) => {
      const consumed = row[`${key}_consumed`];
      const exported_ = row[`${key}_exported`];
      if (consumed !== "" || exported_ !== "") {
        records.push({
          solar_system_id: row.solar_system_id,
          month: num,
          energy_consumed_from_grid: consumed === "" ? null : Number(consumed),
          energy_exported_to_grid: exported_ === "" ? null : Number(exported_),
        });
      }
    });
  });
  return records;
};

const SolarDataTable = () => {
  const { getSolarSystems, saveSolarBulkData } = useOperatorApi();
  const navigate = useNavigate();
  const [solarSystems, setSolarSystems] = useState<SolarSystem[]>([]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [systemsLoading, setSystemsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType }>({
    message: "",
    type: "success",
  });

  useEffect(() => {
    setSystemsLoading(true);
    getSolarSystems()
      .then((systems) => setSolarSystems((systems as SolarSystem[]) || []))
      .catch((error: unknown) =>
        setToast({
          message: getApiErrorMessage(error, "Failed to load solar systems"),
          type: "error",
        }),
      )
      .finally(() => setSystemsLoading(false));
  }, [getSolarSystems]);

  const columns = [
    {
      accessorKey: "solar_system_id",
      header: "Solar Facility",
      required: true,
      type: "dropdown" as const,
      minWidth: "240px",
      cell: ({
        getValue,
        row,
        column,
        table,
      }: {
        getValue: () => string;
        row: any;
        column: any;
        table: any;
      }) => {
        const value = String(getValue() ?? "");
        const EMPTY_VALUE = "__empty__";
        return (
          <Select
            value={value === "" ? EMPTY_VALUE : value}
            onValueChange={(nextValue) => {
              if (nextValue === null) return;
              table.options.meta?.updateData(
                row.index,
                column.id,
                nextValue === EMPTY_VALUE ? "" : nextValue,
              );
            }}
          >
            <SelectTrigger className="h-9 w-full min-w-[220px] bg-slate-50 text-xs font-semibold text-slate-700">
              <SelectValue placeholder="Select Location" />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value={EMPTY_VALUE}>— Select Location —</SelectItem>
              {solarSystems.map((s: any) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.tehsil} | {s.village}
                  {s.settlement ? ` (${s.settlement})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      },
    },
    {
      accessorKey: "location",
      header: "Area Type",
      type: "dropdown" as const,
      options: ["OHR", "ABR", "OTHER"],
      minWidth: "110px",
    },
    ...MONTHS.flatMap(({ key, label }) => [
      {
        accessorKey: `${key}_consumed`,
        header: `${label.slice(0, 3)} Import`,
        type: "number" as const,
        min: 0,
        showTotal: true,
        minWidth: "105px",
      },
      {
        accessorKey: `${key}_exported`,
        header: `${label.slice(0, 3)} Export`,
        type: "number" as const,
        min: 0,
        showTotal: true,
        minWidth: "105px",
      },
    ]),
    {
      accessorKey: "bill_image",
      header: "Bill Upload",
      type: "image" as const,
      minWidth: "130px",
    },
  ];

  const submitData = async (rows: any[], status: string) => {
    setLoading(true);
    try {
      const records = rowsToRecords(rows, selectedYear);
      if (!records.length) {
        setToast({
          message: "At least one monthly entry is required.",
          type: "error",
        });
        setLoading(false);
        return;
      }
      await saveSolarBulkData({
        rows: records,
        year: selectedYear,
        status,
      });
      setToast({
        message:
          status === "draft" ? " Draft updated!" : "✅ Submission recorded!",
        type: "success",
      });

      if (status === "submitted") {
        setTimeout(() => navigate("/operator/solar-submissions"), 1500);
      }
    } catch (err: unknown) {
      setToast({
        message: getApiErrorMessage(err, "Update failed"),
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
        type={toast.type as ToastType}
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
              background: "linear-gradient(135deg, #f59e0b, #d97706)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 16px -4px rgba(245, 158, 11, 0.3)",
            }}
          >
            <Sun size={28} color="white" />
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
              Energy Monitoring Dashboard
            </h1>
            <p
              style={{
                color: "#64748b",
                margin: "4px 0 0 0",
                fontSize: "15px",
              }}
            >
              Update monthly solar generation and grid exchange metrics
            </p>
          </div>
        </div>

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
            <SelectTrigger className="h-11 w-[140px] border-slate-200 bg-white pl-9 text-sm font-semibold text-slate-800 shadow-sm">
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent align="end">
              {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table Container */}
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
              title={`Solar Generation Logs — ${selectedYear}`}
              columns={columns}
              year={selectedYear}
              onSaveDraft={(rows) => submitData(rows, "draft")}
              onSubmit={(rows) => submitData(rows, "submitted")}
              loading={loading}
              color="#f59e0b"
            />
          </Suspense>
        )}

        <div
          style={{
            marginTop: "28px",
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
              gap: "10px",
              color: "#64748b",
              fontSize: "14px",
            }}
          >
            <Zap size={18} color="#f59e0b" />
            <span>
              <strong>Import:</strong> Energy from grid.{" "}
              <strong>Export:</strong> Excess solar energy to grid.
            </span>
          </div>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "13px" }}>
            Please upload clear photos of net metering bills for verification.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default SolarDataTable;

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
