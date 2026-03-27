import { useMutation } from '@tanstack/react-query'
import {
  createSolarSystem as createSolarSystemService,
  createWaterSystem as createWaterSystemService,
  deleteSolarDraft as deleteSolarDraftService,
  deleteSolarSystem as deleteSolarSystemService,
  deleteWaterDraft as deleteWaterDraftService,
  deleteWaterSystem as deleteWaterSystemService,
  downloadWaterReportPDF as downloadWaterReportPDFService,
  getDashboardGridImport as getDashboardGridImportService,
  getDashboardProgramSummary as getDashboardProgramSummaryService,
  getDashboardPumpHours as getDashboardPumpHoursService,
  getDashboardSolarGeneration as getDashboardSolarGenerationService,
  getDashboardWaterSupplied as getDashboardWaterSuppliedService,
  getMySubmissions as getMySubmissionsService,
  getSolarDraft as getSolarDraftService,
  getSolarDrafts as getSolarDraftsService,
  getSolarSupplyData as getSolarSupplyDataService,
  getSolarSystemConfig as getSolarSystemConfigService,
  getSolarSystems as getSolarSystemsService,
  getWaterDraft as getWaterDraftService,
  getWaterDrafts as getWaterDraftsService,
  getWaterSupplyData as getWaterSupplyDataService,
  getWaterSystemConfig as getWaterSystemConfigService,
  getWaterSystems as getWaterSystemsService,
  saveSolarSupplyData as saveSolarSupplyDataService,
  saveSolarBulkData as saveSolarBulkDataService,
  saveWaterSupplyData as saveWaterSupplyDataService,
  saveWaterBulkData as saveWaterBulkDataService,
  submitSolarDraft as submitSolarDraftService,
  submitWaterDraft as submitWaterDraftService,
  uploadImage as uploadImageService,
  type AnyRecord,
  type QueryFilters,
} from '../services'

export function useOperatorApi() {
  const createSolarSystemMutation = useMutation({
    mutationFn: (payload: AnyRecord) => createSolarSystemService(payload),
  })
  const createWaterSystemMutation = useMutation({
    mutationFn: (payload: AnyRecord) => createWaterSystemService(payload),
  })
  const getSolarSystemsMutation = useMutation({ mutationFn: () => getSolarSystemsService() })
  const getWaterSystemsMutation = useMutation({ mutationFn: () => getWaterSystemsService() })
  const getSolarDraftsMutation = useMutation({ mutationFn: () => getSolarDraftsService() })
  const getWaterDraftsMutation = useMutation({ mutationFn: () => getWaterDraftsService() })
  const getSolarDraftMutation = useMutation({
    mutationFn: (draftId: string | number) => getSolarDraftService(draftId),
  })
  const getWaterDraftMutation = useMutation({
    mutationFn: (draftId: string | number) => getWaterDraftService(draftId),
  })
  const submitSolarDraftMutation = useMutation({
    mutationFn: (draftId: string | number) => submitSolarDraftService(draftId),
  })
  const submitWaterDraftMutation = useMutation({
    mutationFn: (draftId: string | number) => submitWaterDraftService(draftId),
  })
  const deleteSolarDraftMutation = useMutation({
    mutationFn: (draftId: string | number) => deleteSolarDraftService(draftId),
  })
  const deleteWaterDraftMutation = useMutation({
    mutationFn: (draftId: string | number) => deleteWaterDraftService(draftId),
  })
  const deleteSolarSystemMutation = useMutation({
    mutationFn: (systemId: string | number) => deleteSolarSystemService(systemId),
  })
  const deleteWaterSystemMutation = useMutation({
    mutationFn: (systemId: string | number) => deleteWaterSystemService(systemId),
  })
  const getMySubmissionsMutation = useMutation({
    mutationFn: (status?: string) => getMySubmissionsService(status),
  })
  const getSolarSystemConfigMutation = useMutation({
    mutationFn: ({ tehsil, village, settlement }: { tehsil: string; village: string; settlement: string }) =>
      getSolarSystemConfigService(tehsil, village, settlement),
  })
  const getWaterSystemConfigMutation = useMutation({
    mutationFn: ({ tehsil, village, settlement }: { tehsil: string; village: string; settlement: string }) =>
      getWaterSystemConfigService(tehsil, village, settlement),
  })
  const getSolarSupplyDataMutation = useMutation({
    mutationFn: (filters: QueryFilters) => getSolarSupplyDataService(filters),
  })
  const getWaterSupplyDataMutation = useMutation({
    mutationFn: (filters: QueryFilters) => getWaterSupplyDataService(filters),
  })
  const saveSolarSupplyDataMutation = useMutation({
    mutationFn: (payload: AnyRecord) => saveSolarSupplyDataService(payload),
  })
  const saveWaterSupplyDataMutation = useMutation({
    mutationFn: (payload: AnyRecord) => saveWaterSupplyDataService(payload),
  })
  const saveSolarBulkDataMutation = useMutation({
    mutationFn: (payload: AnyRecord) => saveSolarBulkDataService(payload),
  })
  const saveWaterBulkDataMutation = useMutation({
    mutationFn: (payload: AnyRecord) => saveWaterBulkDataService(payload),
  })
  const uploadImageMutation = useMutation({
    mutationFn: ({ file, recordId, recordType }: { file: File; recordId: string | number; recordType: string }) =>
      uploadImageService(file, recordId, recordType),
  })
  const downloadWaterReportPDFMutation = useMutation({
    mutationFn: ({ systemId, year }: { systemId: string | number; year: string | number }) =>
      downloadWaterReportPDFService(systemId, year),
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
    createSolarSystem: createSolarSystemMutation.mutateAsync,
    createWaterSystem: createWaterSystemMutation.mutateAsync,
    getSolarSystems: getSolarSystemsMutation.mutateAsync,
    getWaterSystems: getWaterSystemsMutation.mutateAsync,
    getSolarDrafts: getSolarDraftsMutation.mutateAsync,
    getWaterDrafts: getWaterDraftsMutation.mutateAsync,
    getSolarDraft: getSolarDraftMutation.mutateAsync,
    getWaterDraft: getWaterDraftMutation.mutateAsync,
    submitSolarDraft: submitSolarDraftMutation.mutateAsync,
    submitWaterDraft: submitWaterDraftMutation.mutateAsync,
    deleteSolarDraft: deleteSolarDraftMutation.mutateAsync,
    deleteWaterDraft: deleteWaterDraftMutation.mutateAsync,
    deleteSolarSystem: deleteSolarSystemMutation.mutateAsync,
    deleteWaterSystem: deleteWaterSystemMutation.mutateAsync,
    getMySubmissions: getMySubmissionsMutation.mutateAsync,
    getSolarSystemConfig: (tehsil: string, village: string, settlement: string) =>
      getSolarSystemConfigMutation.mutateAsync({ tehsil, village, settlement }),
    getWaterSystemConfig: (tehsil: string, village: string, settlement: string) =>
      getWaterSystemConfigMutation.mutateAsync({ tehsil, village, settlement }),
    getSolarSupplyData: getSolarSupplyDataMutation.mutateAsync,
    getWaterSupplyData: getWaterSupplyDataMutation.mutateAsync,
    saveSolarSupplyData: saveSolarSupplyDataMutation.mutateAsync,
    saveWaterSupplyData: saveWaterSupplyDataMutation.mutateAsync,
    saveSolarBulkData: saveSolarBulkDataMutation.mutateAsync,
    saveWaterBulkData: saveWaterBulkDataMutation.mutateAsync,
    uploadImage: (file: File, recordId: string | number, recordType: string) =>
      uploadImageMutation.mutateAsync({ file, recordId, recordType }),
    downloadWaterReportPDF: (systemId: string | number, year: string | number) =>
      downloadWaterReportPDFMutation.mutateAsync({ systemId, year }),
    getDashboardProgramSummary: getDashboardProgramSummaryMutation.mutateAsync,
    getDashboardWaterSupplied: getDashboardWaterSuppliedMutation.mutateAsync,
    getDashboardPumpHours: getDashboardPumpHoursMutation.mutateAsync,
    getDashboardSolarGeneration: getDashboardSolarGenerationMutation.mutateAsync,
    getDashboardGridImport: getDashboardGridImportMutation.mutateAsync,
  }
}

