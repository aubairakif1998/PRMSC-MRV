import { useMutation } from "@tanstack/react-query";
import {
  getDashboardGridImport as getDashboardGridImportService,
  getDashboardProgramSummary as getDashboardProgramSummaryService,
  getDashboardPumpHours as getDashboardPumpHoursService,
  getDashboardSolarGeneration as getDashboardSolarGenerationService,
  getDashboardWaterSupplied as getDashboardWaterSuppliedService,
} from "../services/tehsilManagerOperatorService";
import type { QueryFilters } from "../services/types";

/**
 * Organization-wide `/dashboard/*` KPIs for executive views (`/hq`, Program dashboard).
 */
export function useProgramDashboardApi() {
  const getDashboardProgramSummaryMutation = useMutation({
    mutationFn: (filters: QueryFilters) =>
      getDashboardProgramSummaryService(filters),
  });
  const getDashboardWaterSuppliedMutation = useMutation({
    mutationFn: (filters: QueryFilters) =>
      getDashboardWaterSuppliedService(filters),
  });
  const getDashboardPumpHoursMutation = useMutation({
    mutationFn: (filters: QueryFilters) => getDashboardPumpHoursService(filters),
  });
  const getDashboardSolarGenerationMutation = useMutation({
    mutationFn: (filters: QueryFilters) =>
      getDashboardSolarGenerationService(filters),
  });
  const getDashboardGridImportMutation = useMutation({
    mutationFn: (filters: QueryFilters) =>
      getDashboardGridImportService(filters),
  });

  return {
    getDashboardProgramSummary: getDashboardProgramSummaryMutation.mutateAsync,
    getDashboardWaterSupplied: getDashboardWaterSuppliedMutation.mutateAsync,
    getDashboardPumpHours: getDashboardPumpHoursMutation.mutateAsync,
    getDashboardSolarGeneration: getDashboardSolarGenerationMutation.mutateAsync,
    getDashboardGridImport: getDashboardGridImportMutation.mutateAsync,
  };
}
