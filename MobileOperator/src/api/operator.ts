/**
 * Mirrors `backend/app/routes/operator.py`:
 * - `POST /operator/water-supply-data` (`save_water_supply_data`): JSON must include non-empty `data[]`;
 *   each item has `tehsil`, `village`, `settlement`, `monthlyData[]` with `month`, `pump_operating_hours`, `total_water_pumped`;
 *   top-level `year`, `status`, optional `image_url` / `image_path`. Empty `data` → 400 "No data provided".
 * - `POST /operator/solar-supply-data` (`save_solar_supply_data`): same, with `energy_consumed_from_grid`, `energy_exported_to_grid` in each month row.
 * - `POST /operator/upload` (`upload_image`): multipart `file` + `record_type` (`water`|`solar`); `record_id` optional. Returns `image_url` / `path`.
 */
import { apiClient } from './client';
import type { AnyRecord, QueryFilters } from './types';
import { buildQueryString } from './types';
import type { EvidenceAsset, SolarLogInput, WaterLogInput } from '../types/operator';

type SubmitOptions = {
  idempotencyKey?: string;
  /** Public URL from `/operator/upload`, applied as `image_url` / `image_path` on the save body (same as web). */
  imageUrl?: string;
};

function isSupplyPostBody(p: unknown): p is AnyRecord {
  return p != null && typeof p === 'object' && Array.isArray((p as AnyRecord).data);
}

/** Matches `WaterSupplyDataForm` payload: `{ data: [{ tehsil, village, settlement, monthlyData }], year, status }`. */
function buildWaterSupplyBody(
  input: WaterLogInput,
  opts: { status?: 'draft' | 'submitted'; imageUrl?: string },
): AnyRecord {
  const status = opts.status ?? 'submitted';
  const body: AnyRecord = {
    data: [
      {
        tehsil: input.tehsil,
        village: input.village,
        settlement: input.settlement ?? '',
        monthlyData: [
          {
            month: input.month,
            pump_operating_hours: null,
            total_water_pumped:
              input.totalWaterPumping != null ? String(input.totalWaterPumping) : null,
          },
        ],
      },
    ],
    year: input.year,
    status,
  };
  if (opts.imageUrl) {
    body.image_url = opts.imageUrl;
    body.image_path = opts.imageUrl;
  }
  return body;
}

/** Matches `SolarSupplyDataForm` payload. */
function buildSolarSupplyBody(
  input: SolarLogInput,
  opts: { status?: 'draft' | 'submitted'; imageUrl?: string },
): AnyRecord {
  const status = opts.status ?? 'submitted';
  const body: AnyRecord = {
    data: [
      {
        tehsil: input.tehsil,
        village: input.village,
        settlement: input.settlement ?? '',
        monthlyData: [
          {
            month: input.month,
            energy_consumed_from_grid:
              input.energyConsumedFromGrid != null ? String(input.energyConsumedFromGrid) : null,
            energy_exported_to_grid:
              input.energyExportedToGrid != null ? String(input.energyExportedToGrid) : null,
          },
        ],
      },
    ],
    year: input.year,
    status,
  };
  if (opts.imageUrl) {
    body.image_url = opts.imageUrl;
    body.image_path = opts.imageUrl;
  }
  return body;
}

function idempotencyHeaders(idempotencyKey?: string) {
  if (!idempotencyKey) return undefined;
  return {
    'Idempotency-Key': idempotencyKey,
    'X-Idempotency-Key': idempotencyKey,
  };
}

export async function createWaterSystem(formData: AnyRecord) {
  const res = await apiClient.post('/operator/water-system', formData);
  return res.data as AnyRecord;
}

export async function submitWaterMonthlyData(formData: AnyRecord) {
  const res = await apiClient.post('/operator/water-data', formData);
  return res.data as AnyRecord;
}

export async function getWaterSystemConfig(tehsil: string, village: string, settlement: string) {
  const params = new URLSearchParams({ tehsil, village, settlement }).toString();
  const res = await apiClient.get(`/operator/water-system-config?${params}`);
  return res.data as AnyRecord;
}

export async function getWaterSystems() {
  const res = await apiClient.get('/operator/water-systems');
  return res.data as unknown[];
}

export async function getSolarSystemConfig(tehsil: string, village: string, settlement: string) {
  const params = new URLSearchParams({ tehsil, village, settlement }).toString();
  const res = await apiClient.get(`/operator/solar-system-config?${params}`);
  return res.data as AnyRecord;
}

/** Fetches PDF bytes; use `react-native-share` or file save in UI if needed. */
export async function downloadWaterReportPDF(systemId: string | number, year: string | number) {
  const res = await apiClient.get(`/operator/water-report-pdf/${systemId}/${year}`, {
    responseType: 'arraybuffer',
  });
  return res.data as ArrayBuffer;
}

export async function createSolarSystem(formData: AnyRecord) {
  const res = await apiClient.post('/operator/solar-system', formData);
  return res.data as AnyRecord;
}

export async function submitSolarMonthlyData(formData: AnyRecord) {
  const res = await apiClient.post('/operator/solar-data', formData);
  return res.data as AnyRecord;
}

export async function getMySubmissions(status?: string) {
  const params = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await apiClient.get(`/operator/my-submissions${params}`);
  return res.data as { submissions?: Array<Record<string, unknown>> };
}

/** Full submission + record_data + audit_trail (tubewell operator’s own submission). */
export async function getSubmissionDetail(submissionId: string) {
  const res = await apiClient.get(
    `/operator/tubewell/submission/${encodeURIComponent(submissionId)}`,
  );
  return res.data as {
    submission?: Record<string, unknown>;
    record_data?: Record<string, unknown>;
    audit_trail?: Array<Record<string, unknown>>;
  };
}

export async function getDashboardProgramSummary(filters: QueryFilters = {}) {
  const res = await apiClient.get(`/dashboard/program-summary${buildQueryString(filters)}`);
  return res.data as { ohr_count?: number; solar_facilities?: number; bulk_meters?: number };
}

export async function getDashboardWaterSupplied(filters: QueryFilters = {}) {
  const res = await apiClient.get(`/dashboard/water-supplied${buildQueryString(filters)}`);
  return res.data as AnyRecord;
}

export async function getDashboardPumpHours(filters: QueryFilters = {}) {
  const res = await apiClient.get(`/dashboard/pump-hours${buildQueryString(filters)}`);
  return res.data as AnyRecord;
}

export async function getDashboardSolarGeneration(filters: QueryFilters = {}) {
  const res = await apiClient.get(`/dashboard/solar-generation${buildQueryString(filters)}`);
  return res.data as AnyRecord;
}

export async function getDashboardGridImport(filters: QueryFilters = {}) {
  const res = await apiClient.get(`/dashboard/grid-import${buildQueryString(filters)}`);
  return res.data as AnyRecord;
}

export async function getWaterDrafts() {
  const res = await apiClient.get('/operator/water-data/drafts');
  return res.data as { drafts?: unknown[] };
}

export async function getSolarDrafts() {
  const res = await apiClient.get('/operator/solar-data/drafts');
  return res.data as { drafts?: unknown[] };
}

export async function getWaterDraft(draftId: string | number) {
  const res = await apiClient.get(`/operator/water-data/draft/${draftId}`);
  return res.data as AnyRecord;
}

export async function getSolarDraft(draftId: string | number) {
  const res = await apiClient.get(`/operator/solar-data/draft/${draftId}`);
  return res.data as AnyRecord;
}

export async function submitWaterDraft(draftId: string | number) {
  const res = await apiClient.post(`/operator/water-data/draft/${draftId}/submit`);
  return res.data as AnyRecord;
}

export async function submitSolarDraft(draftId: string | number) {
  const res = await apiClient.post(`/operator/solar-data/draft/${draftId}/submit`);
  return res.data as AnyRecord;
}

export async function deleteWaterDraft(draftId: string | number) {
  const res = await apiClient.delete(`/operator/water-data/draft/${draftId}`);
  return res.data as AnyRecord;
}

export async function deleteSolarDraft(draftId: string | number) {
  const res = await apiClient.delete(`/operator/solar-data/draft/${draftId}`);
  return res.data as AnyRecord;
}

export async function deleteWaterSystem(systemId: string | number) {
  const res = await apiClient.delete(`/operator/water-system/${systemId}`);
  return res.data as AnyRecord;
}

export async function deleteSolarSystem(systemId: string | number) {
  const res = await apiClient.delete(`/operator/solar-system/${systemId}`);
  return res.data as AnyRecord;
}

export async function getSolarSystems() {
  const res = await apiClient.get('/operator/solar-systems');
  return res.data as unknown[];
}

export async function getWaterSupplyData(filters: QueryFilters = {}) {
  const res = await apiClient.get(`/operator/water-supply-data${buildQueryString(filters)}`);
  return res.data as unknown;
}

export async function saveWaterSupplyData(payload: WaterLogInput | AnyRecord, options?: SubmitOptions) {
  let body: AnyRecord;
  if (isSupplyPostBody(payload)) {
    body = { ...payload };
    if (options?.imageUrl) {
      body.image_url = options.imageUrl;
      body.image_path = options.imageUrl;
    }
  } else {
    body = buildWaterSupplyBody(payload as WaterLogInput, {
      status: 'submitted',
      imageUrl: options?.imageUrl,
    });
  }
  const res = await apiClient.post('/operator/water-supply-data', body, {
    headers: idempotencyHeaders(options?.idempotencyKey),
  });
  return res.data as Record<string, unknown>;
}

export async function saveWaterBulkData(payload: AnyRecord) {
  const res = await apiClient.post('/operator/water-data/bulk', payload);
  return res.data as AnyRecord;
}

export async function getSolarSupplyData(filters: QueryFilters = {}) {
  const res = await apiClient.get(`/operator/solar-supply-data${buildQueryString(filters)}`);
  return res.data as unknown;
}

export async function saveSolarSupplyData(payload: SolarLogInput | AnyRecord, options?: SubmitOptions) {
  let body: AnyRecord;
  if (isSupplyPostBody(payload)) {
    body = { ...payload };
    if (options?.imageUrl) {
      body.image_url = options.imageUrl;
      body.image_path = options.imageUrl;
    }
  } else {
    body = buildSolarSupplyBody(payload as SolarLogInput, {
      status: 'submitted',
      imageUrl: options?.imageUrl,
    });
  }
  const res = await apiClient.post('/operator/solar-supply-data', body, {
    headers: idempotencyHeaders(options?.idempotencyKey),
  });
  return res.data as Record<string, unknown>;
}

export async function saveSolarBulkData(payload: AnyRecord) {
  const res = await apiClient.post('/operator/solar-data/bulk', payload);
  return res.data as AnyRecord;
}

function extractRecordId(response: Record<string, unknown>): string | number | undefined {
  const directId = response.id;
  if (typeof directId === 'string' || typeof directId === 'number') return directId;

  const record = response.record as Record<string, unknown> | undefined;
  const nestedId = record?.id;
  if (typeof nestedId === 'string' || typeof nestedId === 'number') return nestedId;

  const data = response.data as Record<string, unknown> | undefined;
  const dataId = data?.id;
  if (typeof dataId === 'string' || typeof dataId === 'number') return dataId;

  return undefined;
}

/** Upload first, then pass returned URL as `imageUrl` on `save*SupplyData` (matches web `WaterSupplyDataForm`). */
export async function uploadEvidenceFile(
  recordType: 'water' | 'solar',
  asset: EvidenceAsset,
): Promise<Record<string, unknown>> {
  const formData = new FormData();
  formData.append('record_type', recordType);
  formData.append('file', {
    uri: asset.uri,
    name: asset.fileName || `${recordType}-evidence.jpg`,
    type: asset.type || 'image/jpeg',
  } as unknown as Blob);

  const res = await apiClient.post('/operator/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data as Record<string, unknown>;
}

/** @deprecated Prefer `uploadEvidenceFile` + `imageUrl` on save; kept for callers that post after save with a record id. */
export async function uploadEvidence(recordType: 'water' | 'solar', recordResponse: Record<string, unknown>, asset: EvidenceAsset) {
  const recordId = extractRecordId(recordResponse);
  if (!recordId) return;

  const formData = new FormData();
  formData.append('record_id', String(recordId));
  formData.append('record_type', recordType);
  formData.append('file', {
    uri: asset.uri,
    name: asset.fileName || `${recordType}-${recordId}.jpg`,
    type: asset.type || 'image/jpeg',
  } as unknown as Blob);

  await apiClient.post('/operator/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}
