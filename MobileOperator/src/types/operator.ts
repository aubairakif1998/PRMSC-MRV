export type LogType = 'water'

export type WaterLogInput = {
  year: number
  month: number
  /** Calendar day (1–31). Maps to API `monthlyData[].day` → server `log_date`. */
  day: number
  tehsil: string
  village: string
  settlement?: string
  /** Mirrors assigned system setting where bulk meter is not installed. */
  noBulkMeterInstalled?: boolean
  /** Cumulative bulk-meter reading before pump start (first log only). */
  meterReadingStart?: number | null
  /** Cumulative bulk-meter reading at pump stop. */
  meterReadingEnd?: number | null
  /** @deprecated Use meterReadingEnd — kept for queued offline payloads. */
  totalWaterPumping?: number | null
  /**
   * Maps to API `monthlyData[].pump_start_time` / `pump_end_time`.
   * Server derives `pump_operating_hours` from the interval.
   */
  pumpStartTime?: string | null
  pumpEndTime?: string | null
}

export type EvidenceAsset = {
  uri: string
  fileName?: string
  type?: string
}

type QueueMeta = {
  idempotencyKey?: string
  attemptCount?: number
  lastError?: string
  lastTriedAt?: string
}

export type QueueItem =
  | {
      id: string
      type: 'water'
      payload: WaterLogInput
      evidence?: EvidenceAsset | null
      /** When re-submitting an edit without a new photo, reuse server meter image URL. */
      existingImageUrl?: string
      createdAt: string
      queueKey?: string
    } & QueueMeta
  | ({
      id: string
      type: 'water_draft'
      payload: WaterLogInput
      evidence?: EvidenceAsset | null
      /** When saving a draft update without a new photo, reuse server meter image URL. */
      existingImageUrl?: string
      createdAt: string
      queueKey?: string
    } & QueueMeta)

