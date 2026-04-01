import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Activity,
  BarChart2,
  Building,
  Droplet,
  Plus,
  Sun,
} from "lucide-react";

import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Label } from "../../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { Spinner } from "../../../components/ui/spinner";
import { tehsilRoutes } from "../../../constants/routes";
import { canRegisterTehsilFacilities } from "../../../constants/roles";
import { useAuth } from "../../../contexts/AuthContext";
import { TEHSIL_OPTIONS, LOCATION_DATA } from "../../../utils/locationData";
import { useTehsilProgramSummary } from "../../../hooks";
import { getApiErrorMessage } from "../../../lib/api-error";

type Filters = {
  tehsil: string;
  village: string;
  month: string | number;
  year: number;
};

/**
 * Tehsil Manager Operator (ADMIN) — scoped to assigned tehsil(s);
 * register water/solar in tehsil; monthly solar energy logging only.
 */
const TehsilManagerDashboard = () => {
  const { user } = useAuth();
  const showFacilityRegistration = canRegisterTehsilFacilities(user?.role);
  const navigate = useNavigate();

  const scopedTehsils = useMemo((): string[] => {
    const t = (user?.tehsils ?? []).filter(
      (x): x is string => typeof x === "string" && x.trim().length > 0,
    );
    return t.length > 0 ? t : [...TEHSIL_OPTIONS];
  }, [user?.tehsils]);

  const currentYear = new Date().getFullYear();
  const defaultTehsil = useMemo((): string => {
    if (scopedTehsils.length === 1) {
      const only = scopedTehsils[0];
      if (only !== undefined) return only;
    }
    return "All Tehsils";
  }, [scopedTehsils]);

  const [filters, setFilters] = useState<Filters>({
    tehsil: defaultTehsil,
    village: "All Villages",
    month: "",
    year: currentYear,
  });
  const [activeFilters, setActiveFilters] = useState<Filters>({ ...filters });

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      tehsil: defaultTehsil,
      village: "All Villages",
    }));
    setActiveFilters((prev) => ({
      ...prev,
      tehsil: defaultTehsil,
      village: "All Villages",
    }));
  }, [defaultTehsil]);

  const TEHSILS = useMemo(() => {
    if (scopedTehsils.length === 1) return scopedTehsils;
    return ["All Tehsils", ...scopedTehsils];
  }, [scopedTehsils]);

  const [villageOptions, setVillageOptions] = useState<string[]>([
    "All Villages",
  ]);

  const {
    data: summary,
    isLoading: statsLoading,
    isError: statsError,
    error: statsErrorObject,
  } = useTehsilProgramSummary(activeFilters);

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
  };

  const tehsilHint =
    (user?.tehsils?.length ?? 0) > 0
      ? `Your tehsil${(user?.tehsils?.length ?? 0) > 1 ? "s" : ""}: ${(user?.tehsils ?? []).join(", ")}`
      : "Assign tehsils to your account in admin if filters look too broad.";

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
            Tehsil command center,{" "}
            <span className="text-[#0b66c3]">{user?.name || "Manager"}</span>
          </h1>
          <p className="mt-2 text-sm text-slate-600 md:text-base">
            Register infrastructure, enter monthly solar data (direct save),
            review legacy submission rows if any, and onboard operators.
            Tubewell operators use the{" "}
            <span className="font-medium text-slate-800">mobile app</span> for
            monthly water readings and drafts.
          </p>
          <p className="mt-1 text-xs text-slate-500">{tehsilHint}</p>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <StatsCard
            title="OHR / water systems"
            value={safeSummary.ohr_count}
            desc="In selected scope"
            icon={<Building className="size-5 text-blue-600" />}
            loading={statsLoading}
          />
          <StatsCard
            title="Solar facilities"
            value={safeSummary.solar_facilities}
            desc="PV sites in scope"
            icon={<Sun className="size-5 text-amber-600" />}
            loading={statsLoading}
          />
        </div>

        <Card className="rounded-2xl border-slate-200">
          <CardHeader>
            <CardTitle className="text-base">Scope filters</CardTitle>
            <CardDescription>
              KPIs respect tehsil (and village) — aligned with your assignment.
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
              disabled={scopedTehsils.length === 1}
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
                Apply filters
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-2">
          <Activity className="size-5 text-slate-700" />
          <h2 className="text-lg font-bold text-slate-800">
            Tehsil operations
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ManagementCard
            title="Water infrastructure"
            description="Register tube wells and pump specifications for villages in your tehsil. Monthly water volumes and drafts are captured by tubewell operators in the mobile app—not in this portal."
            tag="Water system"
            tagVariant="secondary"
            icon={<Droplet className="size-6 text-blue-600" />}
            {...(showFacilityRegistration
              ? {
                  primaryAction: {
                    label: "Register water system",
                    onClick: () => {
                      navigate(tehsilRoutes.waterForm);
                    },
                    icon: <Plus className="size-4" />,
                    variant: "default" as const,
                    className: "bg-blue-600 hover:bg-blue-700",
                  },
                }
              : {})}
          />
          <ManagementCard
            title="Solar generation"
            description="Register PV sites, then log monthly import/export and net-metering evidence — saved directly for MRV (no draft or verification step on these screens)."
            tag="Solar"
            tagVariant="outline"
            icon={<Sun className="size-6 text-amber-600" />}
            {...(showFacilityRegistration
              ? {
                  primaryAction: {
                    label: "Register solar site",
                    onClick: () => {
                      navigate(tehsilRoutes.solarForm);
                    },
                    icon: <Plus className="size-4" />,
                    variant: "default" as const,
                    className: "bg-amber-600 hover:bg-amber-700",
                  },
                }
              : {})}
            secondaryAction={{
              label: "Monthly solar logs",
              onClick: () => {
                navigate(tehsilRoutes.solarEnergy);
              },
              icon: <BarChart2 className="size-4" />,
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
        <Badge variant="outline">Tehsil</Badge>
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
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterSelectOption[];
  disabled?: boolean;
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
        disabled={disabled}
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
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon: React.ReactNode;
    variant: "default";
    className?: string;
  };
  secondaryAction?: {
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
        <CardContent className="flex flex-wrap gap-3">
          {primaryAction ? (
            <Button
              className={`h-10 gap-2 ${primaryAction.className ?? ""}`}
              onClick={primaryAction.onClick}
              variant={primaryAction.variant}
            >
              {primaryAction.label}
              {primaryAction.icon}
            </Button>
          ) : null}
          {secondaryAction ? (
            <Button
              className="h-10 gap-2"
              onClick={secondaryAction.onClick}
              variant="outline"
            >
              {secondaryAction.label}
              {secondaryAction.icon}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default TehsilManagerDashboard;
