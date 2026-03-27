import { useMutation } from '@tanstack/react-query'
import {
  calculateEmissions as calculateEmissionsService,
  getDashboardCharts as getDashboardChartsService,
  getDashboardStats as getDashboardStatsService,
  getEmissionAudit as getEmissionAuditService,
  getEmissionsSummary as getEmissionsSummaryService,
  getEmissionsTrend as getEmissionsTrendService,
  getAllPredictions as getAllPredictionsService,
  getGridConsumptionPredictions as getGridConsumptionPredictionsService,
  getPredictionLocations as getPredictionLocationsService,
  getSolarGenerationPredictions as getSolarGenerationPredictionsService,
  getSystemComparison as getSystemComparisonService,
  trainPredictionModels as trainPredictionModelsService,
  getVerificationAuditLogs as getVerificationAuditLogsService,
  getWaterDemandPredictions as getWaterDemandPredictionsService,
  getSubmissions as getSubmissionsService,
  type QueryFilters,
} from '../services'
import {
  getDashboardGridImport as getDashboardGridImportService,
  getDashboardProgramSummary as getDashboardProgramSummaryService,
  getDashboardPumpHours as getDashboardPumpHoursService,
  getDashboardSolarGeneration as getDashboardSolarGenerationService,
  getDashboardWaterSupplied as getDashboardWaterSuppliedService,
} from '../services/operatorService'

export function useAnalystApi() {
  const getDashboardStatsMutation = useMutation({
    mutationFn: (filters: Record<string, string> = {}) => getDashboardStatsService(filters),
  })
  const getDashboardChartsMutation = useMutation({
    mutationFn: () => getDashboardChartsService(),
  })
  const getSubmissionsMutation = useMutation({
    mutationFn: () => getSubmissionsService(),
  })
  const getEmissionsSummaryMutation = useMutation({
    mutationFn: (year?: number) => getEmissionsSummaryService(year),
  })
  const getEmissionsTrendMutation = useMutation({
    mutationFn: (year?: number) => getEmissionsTrendService(year),
  })
  const getSystemComparisonMutation = useMutation({
    mutationFn: (year?: number) => getSystemComparisonService(year),
  })
  const calculateEmissionsMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => calculateEmissionsService(payload),
  })
  const getEmissionAuditMutation = useMutation({
    mutationFn: (resultId: string | number) => getEmissionAuditService(resultId),
  })
  const getPredictionLocationsMutation = useMutation({
    mutationFn: () => getPredictionLocationsService(),
  })
  const getWaterDemandPredictionsMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      getWaterDemandPredictionsService(payload),
  })
  const getSolarGenerationPredictionsMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      getSolarGenerationPredictionsService(payload),
  })
  const getGridConsumptionPredictionsMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      getGridConsumptionPredictionsService(payload),
  })
  const getAllPredictionsMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => getAllPredictionsService(payload),
  })
  const trainPredictionModelsMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => trainPredictionModelsService(payload),
  })
  const getVerificationAuditLogsMutation = useMutation({
    mutationFn: (filters: QueryFilters) => getVerificationAuditLogsService(filters),
  })
  const getDashboardProgramSummaryMutation = useMutation({
    mutationFn: (filters: QueryFilters) => getDashboardProgramSummaryService(filters),
  })
  const getDashboardWaterSuppliedMutation = useMutation({
    mutationFn: (filters: QueryFilters) => getDashboardWaterSuppliedService(filters),
  })
  const getDashboardPumpHoursMutation = useMutation({
    mutationFn: (filters: QueryFilters) => getDashboardPumpHoursService(filters),
  })
  const getDashboardSolarGenerationMutation = useMutation({
    mutationFn: (filters: QueryFilters) => getDashboardSolarGenerationService(filters),
  })
  const getDashboardGridImportMutation = useMutation({
    mutationFn: (filters: QueryFilters) => getDashboardGridImportService(filters),
  })

  return {
    getDashboardStats: getDashboardStatsMutation.mutateAsync,
    getDashboardCharts: getDashboardChartsMutation.mutateAsync,
    getSubmissions: getSubmissionsMutation.mutateAsync,
    getEmissionsSummary: getEmissionsSummaryMutation.mutateAsync,
    getEmissionsTrend: getEmissionsTrendMutation.mutateAsync,
    getSystemComparison: getSystemComparisonMutation.mutateAsync,
    calculateEmissions: calculateEmissionsMutation.mutateAsync,
    getEmissionAudit: getEmissionAuditMutation.mutateAsync,
    getPredictionLocations: getPredictionLocationsMutation.mutateAsync,
    getWaterDemandPredictions: getWaterDemandPredictionsMutation.mutateAsync,
    getSolarGenerationPredictions:
      getSolarGenerationPredictionsMutation.mutateAsync,
    getGridConsumptionPredictions:
      getGridConsumptionPredictionsMutation.mutateAsync,
    getAllPredictions: getAllPredictionsMutation.mutateAsync,
    trainPredictionModels: trainPredictionModelsMutation.mutateAsync,
    getVerificationAuditLogs: getVerificationAuditLogsMutation.mutateAsync,
    getDashboardProgramSummary: getDashboardProgramSummaryMutation.mutateAsync,
    getDashboardWaterSupplied: getDashboardWaterSuppliedMutation.mutateAsync,
    getDashboardPumpHours: getDashboardPumpHoursMutation.mutateAsync,
    getDashboardSolarGeneration: getDashboardSolarGenerationMutation.mutateAsync,
    getDashboardGridImport: getDashboardGridImportMutation.mutateAsync,
  }
}

