/**
 * Tubewell operator (USER) endpoints:
 * - `POST /operator/water-supply-data` (`save_water_supply_data`): JSON must include non-empty `data[]`;
 *   each item has `tehsil`, `village`, `settlement`, `monthlyData[]` with `month`, optional `day` (calendar day),
 *   `total_water_pumped`, and `pump_start_time` / `pump_end_time` (server derives `pump_operating_hours`);
 *   top-level `year`, `status`, optional `image_url` / `image_path`. Empty `data` → 400 "No data provided".
 * - `POST /operator/upload` (`upload_image`): multipart `file` + `record_type=water`. Returns `image_url` / `path`.
 * - `GET /operator/water-systems` assigned systems.
 * - `GET /operator/my-submissions` and `GET /operator/tubewell/submission/<id>`.
 */
import { apiClient } from './client';
import type { AnyRecord } from './types';
import type { EvidenceAsset, WaterLogInput } from '../types/operator';
import type { AuthUser } from '../types/auth';
import { STORAGE_KEYS } from '../storage/keys';
import { getJson } from '../storage/jsonStorage';

type SubmitOptions = {
  idempotencyKey?: string;
  /** Public URL from `/operator/upload`, applied as `image_url` / `image_path` on the save body (same as web). */
  imageUrl?: string;
};

function isSupplyPostBody(p: unknown): p is AnyRecord {
  return p != null && typeof p === 'object' && Array.isArray((p as AnyRecord).data);
}

/** Matches `WaterSupplyDataForm` payload: `{ data: [{ tehsil, village, settlement, monthlyData }], year, status }`. */
function safeInt(n: unknown, fallback: number): number {
  const v = Number(n);
  return Number.isFinite(v) ? Math.trunc(v) : fallback;
}

function buildWaterSupplyBody(
  input: WaterLogInput,
  opts: { status?: 'draft' | 'submitted'; imageUrl?: string },
): AnyRecord {
  const status = opts.status ?? 'submitted';
  const now = new Date();
  const tw =
    input.totalWaterPumping != null && Number.isFinite(Number(input.totalWaterPumping))
      ? Number(input.totalWaterPumping)
      : null;
  const hasTimes =
    typeof input.pumpStartTime === 'string' &&
    input.pumpStartTime.trim() &&
    typeof input.pumpEndTime === 'string' &&
    input.pumpEndTime.trim();

  const monthRow: AnyRecord = {
    month: safeInt(input.month, now.getMonth() + 1),
    day: safeInt(input.day, now.getDate()),
    total_water_pumped: tw,
  };
  if (hasTimes) {
    monthRow.pump_start_time = input.pumpStartTime!.trim();
    monthRow.pump_end_time = input.pumpEndTime!.trim();
  }

  const body: AnyRecord = {
    data: [
      {
        tehsil: String(input.tehsil ?? '').trim(),
        village: String(input.village ?? '').trim(),
        settlement: String(input.settlement ?? '').trim(),
        monthlyData: [monthRow],
      },
    ],
    year: safeInt(input.year, now.getFullYear()),
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

export async function getWaterSystems() {
  const res = await apiClient.get('/operator/water-systems');
  const raw = res.data as unknown[];

  // Extra safety: only expose systems assigned to this USER.
  const user = await getJson<AuthUser>(STORAGE_KEYS.user);
  const ids = Array.isArray(user?.water_system_ids)
    ? user!.water_system_ids.map(String).filter(Boolean)
    : [];
  if (ids.length === 0) return raw;
  const allowed = new Set(ids);

  return raw.filter((row) => {
    if (!row || typeof row !== 'object') return false;
    const id = (row as Record<string, unknown>).id;
    return id != null && allowed.has(String(id));
  });
}

/** Fetches PDF bytes; use `react-native-share` or file save in UI if needed. */
export async function downloadWaterReportPDF(systemId: string | number, year: string | number) {
  const res = await apiClient.get(`/operator/water-report-pdf/${systemId}/${year}`, {
    responseType: 'arraybuffer',
  });
  return res.data as ArrayBuffer;
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

export async function getWaterSupplyData(filters: {
  tehsil: string;
  village: string;
  settlement?: string;
  year?: number | string;
}): Promise<unknown[]> {
  const params = new URLSearchParams({
    tehsil: filters.tehsil,
    village: filters.village,
    settlement: filters.settlement ?? '',
    ...(filters.year != null ? { year: String(filters.year) } : {}),
  }).toString();
  const res = await apiClient.get(`/operator/water-supply-data?${params}`);
  return (res.data as unknown[]) ?? [];
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

type SaveDraftResult = { message?: string; ids?: string[]; record_ids?: string[] };

export type WaterDraftSummary = {
  id: string;
  system_id?: string;
  tehsil?: string;
  village?: string;
  year?: number | null;
  month?: number | null;
  day?: number | null;
  bulk_meter_image_url?: string | null;
  status?: string;
  created_at?: string | null;
};

export type WaterDraftDetail = {
  id: string;
  water_system_id?: string;
  year?: number | null;
  month?: number | null;
  day?: number | null;
  pump_start_time?: string | null;
  pump_end_time?: string | null;
  pump_operating_hours?: number | null;
  total_water_pumped?: number | null;
  bulk_meter_image_url?: string | null;
  status?: string;
  tehsil?: string | null;
  village?: string | null;
  settlement?: string | null;
};

export async function getWaterDrafts(): Promise<WaterDraftSummary[]> {
  const res = await apiClient.get('/operator/water-data/drafts');
  const raw = res.data as { drafts?: unknown[] };
  return (raw?.drafts as WaterDraftSummary[]) ?? [];
}

export async function getWaterDraftById(recordId: string): Promise<WaterDraftDetail> {
  const res = await apiClient.get(
    `/operator/water-data/draft/${encodeURIComponent(recordId)}`,
  );
  return res.data as WaterDraftDetail;
}

export async function updateWaterDraftById(recordId: string, input: WaterLogInput) {
  const body: AnyRecord = {
    year: safeInt(input.year, new Date().getFullYear()),
    month: safeInt(input.month, new Date().getMonth() + 1),
    day: safeInt(input.day, new Date().getDate()),
    total_water_pumped:
      input.totalWaterPumping != null && Number.isFinite(Number(input.totalWaterPumping))
        ? Number(input.totalWaterPumping)
        : null,
  };
  if (typeof input.pumpStartTime === 'string' && input.pumpStartTime.trim()) {
    body.pump_start_time = input.pumpStartTime.trim();
  }
  if (typeof input.pumpEndTime === 'string' && input.pumpEndTime.trim()) {
    body.pump_end_time = input.pumpEndTime.trim();
  }
  const res = await apiClient.put(
    `/operator/water-data/draft/${encodeURIComponent(recordId)}`,
    body,
  );
  return res.data as Record<string, unknown>;
}

export async function deleteWaterDraftById(recordId: string) {
  const res = await apiClient.delete(
    `/operator/water-data/draft/${encodeURIComponent(recordId)}`,
  );
  return res.data as Record<string, unknown>;
}

export async function saveWaterSupplyDraft(input: WaterLogInput, options?: SubmitOptions) {
  const body = buildWaterSupplyBody(input, {
    status: 'draft',
    imageUrl: options?.imageUrl,
  });
  const res = await apiClient.post('/operator/water-supply-data', body, {
    headers: idempotencyHeaders(options?.idempotencyKey),
  });
  return res.data as SaveDraftResult;
}

/** Upload first, then pass returned URL as `imageUrl` on `save*SupplyData` (matches web `WaterSupplyDataForm`). */
export async function uploadEvidenceFile(
  recordType: 'water',
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
