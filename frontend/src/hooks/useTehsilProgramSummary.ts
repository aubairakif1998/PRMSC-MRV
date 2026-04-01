import { useQuery } from "@tanstack/react-query";

import { getDashboardProgramSummary } from "../services/tehsilManagerOperatorService";

export type TehsilProgramSummary = {
  ohr_count: number;
  solar_facilities: number;
  bulk_meters: number;
};

export type TehsilProgramSummaryFilters = {
  tehsil?: string;
  village?: string;
  month?: string | number;
  year?: number;
};

/** Tehsil dashboard KPI strip — same `/dashboard/program-summary` API, scoped by filters. */
export function useTehsilProgramSummary(filters: TehsilProgramSummaryFilters) {
  return useQuery({
    queryKey: ["tehsil-program-summary", filters],
    queryFn: async () =>
      (await getDashboardProgramSummary(filters)) as TehsilProgramSummary,
  });
}
