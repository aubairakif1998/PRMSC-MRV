import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  createSolarSystem as createSolarSystemService,
  createWaterSystem as createWaterSystemService,
  getWaterSystem as getWaterSystemService,
  updateWaterSystem as updateWaterSystemService,
  deleteSolarSystem as deleteSolarSystemService,
  deleteWaterSystem as deleteWaterSystemService,
  getMySubmissions as getMySubmissionsService,
  getSolarSupplyData as getSolarSupplyDataService,
  getSolarSupplyRecord as getSolarSupplyRecordService,
  getSolarSystem as getSolarSystemService,
  getSolarSystemConfig as getSolarSystemConfigService,
  getSolarSystems as getSolarSystemsService,
  getWaterSystemConfig as getWaterSystemConfigService,
  getWaterSystems as getWaterSystemsService,
  saveSolarSupplyData as saveSolarSupplyDataService,
  updateSolarSupplyRecord as updateSolarSupplyRecordService,
  deleteSolarSupplyRecord as deleteSolarSupplyRecordService,
  updateSolarSystem as updateSolarSystemService,
  uploadImage as uploadImageService,
  getWaterVerificationQueue as getWaterVerificationQueueService,
  getWaterSubmissionDetailForTehsilManager as getWaterSubmissionDetailForTehsilManagerService,
  acceptWaterSubmission as acceptWaterSubmissionService,
  rejectWaterSubmission as rejectWaterSubmissionService,
  revertWaterSubmission as revertWaterSubmissionService,
} from "../services/tehsilManagerOperatorService";
import type { AnyRecord, QueryFilters } from "../services/types";

/**
 * Mutations for tehsil manager portal pages (`/tehsil/*`) backed by
 * `tehsilManagerOperatorService` / `/operator/*` APIs.
 */
export function useTehsilManagerOperatorApi() {
  const createSolarSystemMutation = useMutation({
    mutationFn: (payload: AnyRecord) => createSolarSystemService(payload),
  });
  const createWaterSystemMutation = useMutation({
    mutationFn: (payload: AnyRecord) => createWaterSystemService(payload),
  });
  const updateWaterSystemMutation = useMutation({
    mutationFn: ({
      systemId,
      payload,
    }: {
      systemId: string | number;
      payload: AnyRecord;
    }) => updateWaterSystemService(systemId, payload),
  });
  const getWaterSystemMutation = useMutation({
    mutationFn: (systemId: string | number) => getWaterSystemService(systemId),
  });
  const getSolarSystemsMutation = useMutation({
    mutationFn: () => getSolarSystemsService(),
  });
  const getWaterSystemsMutation = useMutation({
    mutationFn: () => getWaterSystemsService(),
  });
  const deleteSolarSystemMutation = useMutation({
    mutationFn: (systemId: string | number) => deleteSolarSystemService(systemId),
  });
  const deleteWaterSystemMutation = useMutation({
    mutationFn: (systemId: string | number) => deleteWaterSystemService(systemId),
  });
  const getMySubmissionsMutation = useMutation({
    mutationFn: (status?: string) => getMySubmissionsService(status),
  });
  const getSolarSystemConfigMutation = useMutation({
    mutationFn: ({
      tehsil,
      village,
      settlement,
    }: {
      tehsil: string;
      village: string;
      settlement: string;
    }) => getSolarSystemConfigService(tehsil, village, settlement),
  });
  const getWaterSystemConfigMutation = useMutation({
    mutationFn: ({
      tehsil,
      village,
      settlement,
    }: {
      tehsil: string;
      village: string;
      settlement: string;
    }) => getWaterSystemConfigService(tehsil, village, settlement),
  });
  const getSolarSupplyDataMutation = useMutation({
    mutationFn: (filters: QueryFilters) => getSolarSupplyDataService(filters),
  });
  const saveSolarSupplyDataMutation = useMutation({
    mutationFn: (payload: AnyRecord) => saveSolarSupplyDataService(payload),
  });
  const getSolarSystemMutation = useMutation({
    mutationFn: (systemId: string | number) => getSolarSystemService(systemId),
  });
  const updateSolarSystemMutation = useMutation({
    mutationFn: ({
      systemId,
      payload,
    }: {
      systemId: string | number;
      payload: AnyRecord;
    }) => updateSolarSystemService(systemId, payload),
  });
  const getSolarSupplyRecordMutation = useMutation({
    mutationFn: (recordId: string | number) => getSolarSupplyRecordService(recordId),
  });
  const updateSolarSupplyRecordMutation = useMutation({
    mutationFn: ({
      recordId,
      payload,
    }: {
      recordId: string | number;
      payload: AnyRecord;
    }) => updateSolarSupplyRecordService(recordId, payload),
  });
  const deleteSolarSupplyRecordMutation = useMutation({
    mutationFn: (recordId: string | number) =>
      deleteSolarSupplyRecordService(recordId),
  });
  const uploadImageMutation = useMutation({
    mutationFn: ({
      file,
      recordType,
      recordId,
    }: {
      file: File;
      recordType: string;
      recordId?: string | number | null;
    }) => uploadImageService(file, recordType, recordId),
  });

  const getWaterVerificationQueueMutation = useMutation({
    mutationFn: () => getWaterVerificationQueueService(),
  });
  const getWaterSubmissionDetailForTehsilManagerMutation = useMutation({
    mutationFn: (submissionId: string | number) =>
      getWaterSubmissionDetailForTehsilManagerService(submissionId),
  });
  const acceptWaterSubmissionMutation = useMutation({
    mutationFn: ({
      submissionId,
      payload,
    }: {
      submissionId: string | number;
      payload?: AnyRecord;
    }) => acceptWaterSubmissionService(submissionId, payload ?? {}),
  });
  const rejectWaterSubmissionMutation = useMutation({
    mutationFn: ({
      submissionId,
      payload,
    }: {
      submissionId: string | number;
      payload: AnyRecord;
    }) => rejectWaterSubmissionService(submissionId, payload),
  });
  const revertWaterSubmissionMutation = useMutation({
    mutationFn: ({
      submissionId,
      payload,
    }: {
      submissionId: string | number;
      payload?: AnyRecord;
    }) => revertWaterSubmissionService(submissionId, payload ?? {}),
  });

  const updateWaterSystem = useCallback(
    (systemId: string | number, payload: AnyRecord) =>
      updateWaterSystemMutation.mutateAsync({ systemId, payload }),
    [updateWaterSystemMutation.mutateAsync],
  );
  const getSolarSystemConfig = useCallback(
    (tehsil: string, village: string, settlement: string) =>
      getSolarSystemConfigMutation.mutateAsync({ tehsil, village, settlement }),
    [getSolarSystemConfigMutation.mutateAsync],
  );
  const getWaterSystemConfig = useCallback(
    (tehsil: string, village: string, settlement: string) =>
      getWaterSystemConfigMutation.mutateAsync({ tehsil, village, settlement }),
    [getWaterSystemConfigMutation.mutateAsync],
  );
  const updateSolarSystem = useCallback(
    (systemId: string | number, payload: AnyRecord) =>
      updateSolarSystemMutation.mutateAsync({ systemId, payload }),
    [updateSolarSystemMutation.mutateAsync],
  );
  const updateSolarSupplyRecord = useCallback(
    (recordId: string | number, payload: AnyRecord) =>
      updateSolarSupplyRecordMutation.mutateAsync({ recordId, payload }),
    [updateSolarSupplyRecordMutation.mutateAsync],
  );
  const uploadImage = useCallback(
    (file: File, recordType: string, recordId?: string | number | null) =>
      uploadImageMutation.mutateAsync(
        recordId === undefined
          ? { file, recordType }
          : { file, recordType, recordId },
      ),
    [uploadImageMutation.mutateAsync],
  );

  const acceptWaterSubmission = useCallback(
    (submissionId: string | number, payload?: AnyRecord) =>
      acceptWaterSubmissionMutation.mutateAsync(
        payload === undefined ? { submissionId } : { submissionId, payload },
      ),
    [acceptWaterSubmissionMutation.mutateAsync],
  );
  const rejectWaterSubmission = useCallback(
    (submissionId: string | number, payload: AnyRecord) =>
      rejectWaterSubmissionMutation.mutateAsync({ submissionId, payload }),
    [rejectWaterSubmissionMutation.mutateAsync],
  );
  const revertWaterSubmission = useCallback(
    (submissionId: string | number, payload?: AnyRecord) =>
      revertWaterSubmissionMutation.mutateAsync(
        payload === undefined ? { submissionId } : { submissionId, payload },
      ),
    [revertWaterSubmissionMutation.mutateAsync],
  );

  return {
    createSolarSystem: createSolarSystemMutation.mutateAsync,
    createWaterSystem: createWaterSystemMutation.mutateAsync,
    getWaterSystem: getWaterSystemMutation.mutateAsync,
    updateWaterSystem,
    getSolarSystems: getSolarSystemsMutation.mutateAsync,
    getWaterSystems: getWaterSystemsMutation.mutateAsync,
    deleteSolarSystem: deleteSolarSystemMutation.mutateAsync,
    deleteWaterSystem: deleteWaterSystemMutation.mutateAsync,
    getMySubmissions: getMySubmissionsMutation.mutateAsync,
    getSolarSystemConfig,
    getWaterSystemConfig,
    getSolarSupplyData: getSolarSupplyDataMutation.mutateAsync,
    saveSolarSupplyData: saveSolarSupplyDataMutation.mutateAsync,
    getSolarSystem: getSolarSystemMutation.mutateAsync,
    updateSolarSystem,
    getSolarSupplyRecord: getSolarSupplyRecordMutation.mutateAsync,
    updateSolarSupplyRecord,
    deleteSolarSupplyRecord: deleteSolarSupplyRecordMutation.mutateAsync,
    uploadImage,
    getWaterVerificationQueue: getWaterVerificationQueueMutation.mutateAsync,
    getWaterSubmissionDetailForTehsilManager:
      getWaterSubmissionDetailForTehsilManagerMutation.mutateAsync,
    acceptWaterSubmission,
    rejectWaterSubmission,
    revertWaterSubmission,
  };
}
