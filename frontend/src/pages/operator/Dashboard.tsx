import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Activity,
  BarChart2,
  Building,
  Droplet,
  Loader2,
  Plus,
  Sun,
} from "lucide-react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Spinner } from "../../components/ui/spinner";
import { useAuth } from "../../contexts/AuthContext";
import { TEHSIL_OPTIONS, LOCATION_DATA } from "../../utils/locationData";
import { useOperatorProgramSummary } from "../../hooks/useOperatorProgramSummary";
import { getApiErrorMessage } from "../../lib/api-error";

type Filters = {
  tehsil: string;
  village: string;
  month: string | number;
  year: number;
};

const OperatorDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const currentYear = new Date().getFullYear();
  const [filters, setFilters] = useState<Filters>({
    tehsil: "All Tehsils",
    village: "All Villages",
    month: "",
    year: currentYear,
  });
  const [activeFilters, setActiveFilters] = useState<Filters>({ ...filters });

  const TEHSILS = useMemo(() => ["All Tehsils", ...TEHSIL_OPTIONS], []);
  const [villageOptions, setVillageOptions] = useState<string[]>([
    "All Villages",
  ]);

  const {
    data: summary,
    isLoading: statsLoading,
    isError: statsError,
    error: statsErrorObject,
  } = useOperatorProgramSummary(activeFilters);

  const MONTHS: Array<{ value: string | number; label: string }> = [
    { value: "", label: "All Months" },
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ];

  const YEARS = [currentYear - 1, currentYear, currentYear + 1];

  useEffect(() => {
    const key = filters.tehsil.toUpperCase();
    if (filters.tehsil !== "All Tehsils" && LOCATION_DATA[key]) {
      setVillageOptions(["All Villages", ...LOCATION_DATA[key]]);
    } else {
      setVillageOptions(["All Villages"]);
      setFilters((prev) => ({ ...prev, village: "All Villages" }));
    }
  }, [filters.tehsil]);

  useEffect(() => {
    if (!statsError) return;
    toast.error(
      getApiErrorMessage(
        statsErrorObject,
        "Failed to load dashboard statistics",
      ),
    );
  }, [statsError, statsErrorObject]);

  const handleApplyFilters = () => {
    setActiveFilters({ ...filters });
  };

  const safeSummary = summary ?? {
    ohr_count: 0,
    solar_facilities: 0,
    bulk_meters: 0,
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
            Welcome Back,{" "}
            <span className="text-[#0b66c3]">{user?.name || "Operator"}</span>
          </h1>
          <p className="mt-2 text-sm text-slate-600 md:text-base">
            Manage registrations and monthly reporting from one operator command
            center.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatsCard
            title="Total OHR Systems"
            value={safeSummary.ohr_count}
            desc="Registered infrastructure active"
            icon={<Building className="size-5 text-blue-600" />}
            loading={statsLoading}
          />
          <StatsCard
            title="Solar Facilities"
            value={safeSummary.solar_facilities}
            desc="Sites with PV generation"
            icon={<Sun className="size-5 text-amber-600" />}
            loading={statsLoading}
          />
          <StatsCard
            title="Bulk Meters Installed"
            value={safeSummary.bulk_meters}
            desc="Sites emitting absolute flow data"
            icon={<Activity className="size-5 text-emerald-600" />}
            loading={statsLoading}
          />
        </div>

        <Card className="rounded-2xl border-slate-200">
          <CardHeader>
            <CardTitle className="text-base">Filter Dashboard</CardTitle>
            <CardDescription>
              Apply scope filters for summary metrics.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <FilterSelect
              label="Tehsil"
              value={filters.tehsil}
              onChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  tehsil: value,
                  village: "All Villages",
                }))
              }
              options={TEHSILS}
            />
            <FilterSelect
              label="Village"
              value={filters.village}
              onChange={(value) =>
                setFilters((prev) => ({ ...prev, village: value }))
              }
              options={villageOptions}
            />
            <FilterSelect
              label="Month"
              value={String(filters.month)}
              onChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  month: value === "" ? "" : Number(value),
                }))
              }
              options={MONTHS.map((m) => ({
                label: m.label,
                value: String(m.value),
              }))}
            />
            <FilterSelect
              label="Year"
              value={String(filters.year)}
              onChange={(value) =>
                setFilters((prev) => ({ ...prev, year: Number(value) }))
              }
              options={YEARS.map((year) => ({
                label: String(year),
                value: String(year),
              }))}
            />
            <div className="flex items-end">
              <Button
                className="h-10 w-full gap-2 bg-blue-600 hover:bg-blue-700"
                onClick={handleApplyFilters}
              >
                <Activity className="size-4" />
                Apply Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-2">
          <Activity className="size-5 text-slate-700" />
          <h2 className="text-lg font-bold text-slate-800">
            Operational Management
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ManagementCard
            title="Aquifer & Infrastructure"
            description="Register tube wells, maintain pump specifications, and track monthly flow logs."
            tag="Water System"
            tagVariant="secondary"
            icon={<Droplet className="size-6 text-blue-600" />}
            primaryAction={{
              label: "Register Facility",
              onClick: () => navigate("/operator/water-form"),
              icon: <Plus className="size-4" />,
              variant: "default",
              className: "bg-blue-600 hover:bg-blue-700",
            }}
            secondaryAction={{
              label: "Monthly Logs",
              onClick: () => navigate("/operator/water-data"),
              icon: <BarChart2 className="size-4" />,
            }}
          />
          <ManagementCard
            title="PV Generation & Storage"
            description="Manage solar sites, inverters, and net-metering values for MRV verification."
            tag="Solar Energy"
            tagVariant="outline"
            icon={<Sun className="size-6 text-amber-600" />}
            primaryAction={{
              label: "Register Site",
              onClick: () => navigate("/operator/solar-form"),
              icon: <Plus className="size-4" />,
              variant: "default",
              className: "bg-amber-600 hover:bg-amber-700",
            }}
            secondaryAction={{
              label: "Energy Logs",
              onClick: () => navigate("/operator/solar-energy-data"),
              icon: <Sun className="size-4" />,
            }}
          />
        </div>
      </div>
    </div>
  );
};

type StatsCardProps = {
  title: string;
  value: number;
  icon: React.ReactNode;
  desc: string;
  loading: boolean;
};

const StatsCard = ({ title, value, icon, desc, loading }: StatsCardProps) => (
  <Card className="rounded-2xl border-slate-200">
    <CardHeader className="pb-2">
      <div className="flex items-center justify-between">
        <div className="rounded-xl bg-slate-100 p-2">{icon}</div>
        <Badge variant="outline">Live</Badge>
      </div>
      <CardTitle className="text-sm text-slate-700">{title}</CardTitle>
    </CardHeader>
    <CardContent className="pt-0">
      <div className="text-3xl font-black tracking-tight text-slate-900">
        {loading ? <Spinner className="size-6 text-slate-500" /> : value}
      </div>
      <p className="mt-2 text-sm text-slate-500">{desc}</p>
    </CardContent>
  </Card>
);

type FilterSelectOption = string | { label: string; value: string };

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterSelectOption[];
}) {
  const normalizedOptions = options.map((option) =>
    typeof option === "string" ? { label: option, value: option } : option,
  );
  const EMPTY_VALUE = "__all__";
  const selectValue = value === "" ? EMPTY_VALUE : value;

  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </Label>
      <Select
        value={selectValue}
        onValueChange={(nextValue) => {
          if (nextValue === null) return;
          onChange(nextValue === EMPTY_VALUE ? "" : nextValue);
        }}
      >
        <SelectTrigger className="h-10 w-full rounded-lg border-slate-200 bg-white px-3 text-sm text-slate-700">
          <SelectValue placeholder={`Select ${label}`} />
        </SelectTrigger>
        <SelectContent align="start" className="max-h-72">
          {normalizedOptions.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value === "" ? EMPTY_VALUE : option.value}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ManagementCard({
  title,
  description,
  tag,
  tagVariant,
  icon,
  primaryAction,
  secondaryAction,
}: {
  title: string;
  description: string;
  tag: string;
  tagVariant: "secondary" | "outline";
  icon: React.ReactNode;
  primaryAction: {
    label: string;
    onClick: () => void;
    icon: React.ReactNode;
    variant: "default";
    className?: string;
  };
  secondaryAction: {
    label: string;
    onClick: () => void;
    icon: React.ReactNode;
  };
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="rounded-2xl border-slate-200">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="rounded-xl bg-slate-100 p-3">{icon}</div>
            <Badge variant={tagVariant}>{tag}</Badge>
          </div>
          <CardTitle className="text-xl font-extrabold">{title}</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button
            className={`h-10 gap-2 ${primaryAction.className ?? ""}`}
            onClick={primaryAction.onClick}
            variant={primaryAction.variant}
          >
            {primaryAction.label}
            {primaryAction.icon}
          </Button>
          <Button
            className="h-10 gap-2"
            onClick={secondaryAction.onClick}
            variant="outline"
          >
            {secondaryAction.label}
            {secondaryAction.icon}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default OperatorDashboard;
