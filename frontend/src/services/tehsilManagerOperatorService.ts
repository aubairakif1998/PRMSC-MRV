/**
 * API calls for the tehsil manager operator portal and shared `/operator/*` + `/dashboard/*` resources.
 */
import api from "../api/api";
import { buildQueryString, type AnyRecord, type QueryFilters } from "./types";

export const createWaterSystem = async (formData: AnyRecord) => {
  const response = await api.post("/operator/water-system", formData);
  return response.data;
};

export const updateWaterSystem = async (
  systemId: string | number,
  formData: AnyRecord,
) => {
  const response = await api.put(`/operator/water-system/${systemId}`, formData);
  return response.data;
};

export const getWaterSystem = async (systemId: string | number) => {
  const response = await api.get(`/operator/water-system/${systemId}`);
  return response.data;
};

export const getWaterSystemConfig = async (
  tehsil: string,
  village: string,
  settlement: string,
) => {
  const params = new URLSearchParams({ tehsil, village, settlement }).toString();
  const response = await api.get(`/operator/water-system-config?${params}`);
  return response.data;
};

export const getWaterSystems = async (filters: QueryFilters = {}) => {
  const response = await api.get(`/operator/water-systems${buildQueryString(filters)}`);
  return response.data;
};

export const getSolarSystemConfig = async (
  tehsil: string,
  village: string,
  settlement: string,
) => {
  const params = new URLSearchParams({ tehsil, village, settlement }).toString();
  const response = await api.get(`/operator/solar-system-config?${params}`);
  return response.data;
};

export const createSolarSystem = async (formData: AnyRecord) => {
  const response = await api.post("/operator/solar-system", formData);
  return response.data;
};

export const getSolarSystem = async (systemId: string | number) => {
  const response = await api.get(`/operator/solar-system/${systemId}`);
  return response.data;
};

export const updateSolarSystem = async (
  systemId: string | number,
  formData: AnyRecord,
) => {
  const response = await api.put(`/operator/solar-system/${systemId}`, formData);
  return response.data;
};

export const submitSolarMonthlyData = async (formData: AnyRecord) => {
  const response = await api.post("/operator/solar-data", formData);
  return response.data;
};

/**
 * Upload meter/bill image. If `recordId` is omitted, the file is stored and `image_url`
 * is returned — pass that URL into save payloads (e.g. solar-supply-data).
 */
export const uploadImage = async (
  file: File,
  recordType: string,
  recordId?: string | number | null,
) => {
  const formData = new FormData();
  formData.append("file", file);
  if (recordId != null && String(recordId).trim() !== "") {
    formData.append("record_id", String(recordId));
  }
  formData.append("record_type", recordType);
  const response = await api.post("/operator/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data as AnyRecord;
};

export const getMySubmissions = async (status?: string) => {
  const params = status ? `?status=${encodeURIComponent(status)}` : "";
  const response = await api.get(`/operator/my-submissions${params}`);
  return response.data;
};

export const getDashboardProgramSummary = async (filters: QueryFilters = {}) => {
  const response = await api.get(
    `/dashboard/program-summary${buildQueryString(filters)}`,
  );
  return response.data;
};

export const getDashboardWaterSupplied = async (filters: QueryFilters = {}) => {
  const response = await api.get(
    `/dashboard/water-supplied${buildQueryString(filters)}`,
  );
  return response.data;
};

export const getDashboardPumpHours = async (filters: QueryFilters = {}) => {
  const response = await api.get(
    `/dashboard/pump-hours${buildQueryString(filters)}`,
  );
  return response.data;
};

export const getDashboardSolarGeneration = async (filters: QueryFilters = {}) => {
  const response = await api.get(
    `/dashboard/solar-generation${buildQueryString(filters)}`,
  );
  return response.data;
};

export const getDashboardGridImport = async (filters: QueryFilters = {}) => {
  const response = await api.get(
    `/dashboard/grid-import${buildQueryString(filters)}`,
  );
  return response.data;
};

export const deleteWaterSystem = async (systemId: string | number) => {
  const response = await api.delete(`/operator/water-system/${systemId}`);
  return response.data;
};

export const deleteSolarSystem = async (systemId: string | number) => {
  const response = await api.delete(`/operator/solar-system/${systemId}`);
  return response.data;
};

export const getSolarSystems = async (filters: QueryFilters = {}) => {
  const response = await api.get(`/operator/solar-systems${buildQueryString(filters)}`);
  return response.data;
};

/** Tehsil manager: daily water log + monthly solar log compliance for assigned tehsils. */
export const getLoggingCompliance = async (params: QueryFilters = {}) => {
  const response = await api.get(
    `/operator/logging-compliance${buildQueryString(params)}`,
  );
  return response.data;
};

/** Tehsil manager: list tubewell operators and water-system assignments in scope. */
export const getWaterOperatorAssignments = async () => {
  const response = await api.get("/operator/water-operator-assignments");
  return response.data;
};

/** Tehsil manager: replace one operator's assignments within tehsil scope (`[]` revokes all in scope). */
export const replaceWaterOperatorAssignments = async (
  operatorId: string,
  waterSystemIds: string[],
) => {
  const response = await api.put(
    `/operator/water-operator-assignments/${encodeURIComponent(operatorId)}`,
    { water_system_ids: waterSystemIds },
  );
  return response.data;
};

export const getSolarSupplyData = async (filters: QueryFilters = {}) => {
  const response = await api.get(
    `/operator/solar-supply-data${buildQueryString(filters)}`,
  );
  return response.data;
};

export const saveSolarSupplyData = async (payload: AnyRecord) => {
  const response = await api.post("/operator/solar-supply-data", payload);
  return response.data;
};

export const getSolarSupplyRecord = async (recordId: string | number) => {
  const response = await api.get(`/operator/solar-supply-data/record/${recordId}`);
  return response.data;
};

export const updateSolarSupplyRecord = async (
  recordId: string | number,
  payload: AnyRecord,
) => {
  const response = await api.put(
    `/operator/solar-supply-data/record/${recordId}`,
    payload,
  );
  return response.data;
};

export const deleteSolarSupplyRecord = async (recordId: string | number) => {
  const response = await api.delete(`/operator/solar-supply-data/record/${recordId}`);
  return response.data;
};

/** Tehsil manager (ADMIN): water submission verification queue (tubewell operator daily logs). */
export const getWaterVerificationQueue = async () => {
  const response = await api.get("/operator/verification/pending");
  return response.data;
};

export const getWaterSubmissionDetailForTehsilManager = async (
  submissionId: string | number,
) => {
  const response = await api.get(
    `/operator/tehsil-manager/submission/${encodeURIComponent(String(submissionId))}`,
  );
  return response.data;
};

export const acceptWaterSubmission = async (
  submissionId: string | number,
  payload: AnyRecord = {},
) => {
  const response = await api.post(
    `/operator/verification/${encodeURIComponent(String(submissionId))}/verify`,
    payload,
  );
  return response.data;
};

export const rejectWaterSubmission = async (
  submissionId: string | number,
  payload: AnyRecord,
) => {
  const response = await api.post(
    `/operator/verification/${encodeURIComponent(String(submissionId))}/reject`,
    payload,
  );
  return response.data;
};

export const revertWaterSubmission = async (
  submissionId: string | number,
  payload: AnyRecord = {},
) => {
  const response = await api.post(
    `/operator/verification/${encodeURIComponent(String(submissionId))}/revert`,
    payload,
  );
  return response.data;
};
