import { useCallback, useEffect, useMemo, useState } from "react";
import { LOCATION_DATA, TEHSIL_OPTIONS } from "@/utils/locationData";
import { useAuth } from "@/contexts/AuthContext";
import type { ExecutiveScopeFilters } from "./executiveAnalysisTypes";

export function useExecutiveScopeFilters() {
  const { user } = useAuth();

  const allowedTehsils = useMemo(() => {
    const t = (user?.tehsils ?? [])
      .map((x) => String(x).trim())
      .filter(Boolean);
    return t.length ? t : [...TEHSIL_OPTIONS];
  }, [user?.tehsils]);

  const restrictTehsils = (user?.tehsils ?? []).length > 0;
  const initialTehsil = restrictTehsils
    ? String(user?.tehsils?.[0] ?? "").trim() ||
      allowedTehsils[0] ||
      "All Tehsils"
    : "All Tehsils";

  const [filters, setFilters] = useState<ExecutiveScopeFilters>(() => ({
    tehsil: initialTehsil,
    village: "All Villages",
    month: "All Months",
    year: "2026",
  }));
  const [activeFilters, setActiveFilters] = useState<ExecutiveScopeFilters>(() => ({
    tehsil: initialTehsil,
    village: "All Villages",
    month: "All Months",
    year: "2026",
  }));

  const villageOptions = useMemo(() => {
    if (filters.tehsil === "All Tehsils") return ["All Villages"];
    return [
      "All Villages",
      ...((LOCATION_DATA[filters.tehsil.toUpperCase()] || []) as string[]),
    ];
  }, [filters.tehsil]);

  useEffect(() => {
    if (!restrictTehsils) return;
    const first = allowedTehsils[0];
    if (!first) return;
    setFilters((prev) => {
      if (
        prev.tehsil !== "All Tehsils" &&
        allowedTehsils.includes(prev.tehsil)
      ) {
        return prev;
      }
      return { ...prev, tehsil: first, village: "All Villages" };
    });
    setActiveFilters((prev) => {
      if (
        prev.tehsil !== "All Tehsils" &&
        allowedTehsils.includes(prev.tehsil)
      ) {
        return prev;
      }
      return { ...prev, tehsil: first, village: "All Villages" };
    });
  }, [allowedTehsils, restrictTehsils]);

  const apiFilters = useMemo(
    () => ({
      tehsil: activeFilters.tehsil,
      village: activeFilters.village,
      year: Number(activeFilters.year),
      ...(activeFilters.month !== "All Months"
        ? { month: Number(activeFilters.month) }
        : {}),
    }),
    [activeFilters],
  );

  const activeScopeLabel = useMemo(() => {
    const tehsil =
      activeFilters.tehsil === "All Tehsils"
        ? "All tehsils"
        : activeFilters.tehsil;
    const village =
      activeFilters.village === "All Villages"
        ? "All villages"
        : activeFilters.village;
    const month =
      activeFilters.month === "All Months"
        ? "All months"
        : EXECUTIVE_MONTH_LABEL(Number(activeFilters.month));
    return `${tehsil} · ${village} · ${activeFilters.year} · ${month}`;
  }, [activeFilters]);

  const applyFilters = useCallback(() => {
    setActiveFilters(filters);
  }, [filters]);

  const updateFilter = useCallback(
    <K extends keyof ExecutiveScopeFilters>(key: K, value: ExecutiveScopeFilters[K]) => {
      setFilters((prev) => {
        const next = { ...prev, [key]: value };
        if (key === "tehsil") next.village = "All Villages";
        return next;
      });
    },
    [],
  );

  return {
    filters,
    activeFilters,
    apiFilters,
    activeScopeLabel,
    allowedTehsils,
    restrictTehsils,
    villageOptions,
    applyFilters,
    updateFilter,
  };
}

function EXECUTIVE_MONTH_LABEL(month: number): string {
  const labels = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return labels[month - 1] ?? String(month);
}
