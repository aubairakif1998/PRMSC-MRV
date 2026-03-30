export type LogType = 'water' | 'solar'

export type WaterLogInput = {
  year: number
  month: number
  tehsil: string
  village: string
  settlement?: string
  /** Monthly total from the physical water meter (m³). */
  totalWaterPumping?: number | null
}

export type SolarLogInput = {
  year: number
  month: number
  tehsil: string
  village: string
  settlement?: string
  energyConsumedFromGrid?: number | null
  energyExportedToGrid?: number | null
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
      createdAt: string
      queueKey?: string
    } & QueueMeta
  | ({
      id: string
      type: 'solar'
      payload: SolarLogInput
      evidence?: EvidenceAsset | null
      createdAt: string
      queueKey?: string
    }
    & QueueMeta)

