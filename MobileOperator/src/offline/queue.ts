import NetInfo from '@react-native-community/netinfo'

import { STORAGE_KEYS } from '../storage/keys'
import { getJson, setJson } from '../storage/jsonStorage'
import type { QueueItem, WaterLogInput } from '../types/operator'
import { saveWaterSupplyData, saveWaterSupplyDraft, uploadEvidenceFile } from '../api/operator'
import { nowIsoTimestamp } from '../utils/pakistanTime'

type DrainQueueResult = {
  processed: number
  synced: number
  retained: number
  dropped: number
}

type QueueFailureRecord = QueueItem & {
  droppedAt: string
  dropReason: string
}

function normalizePart(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

/** Same facility + calendar day, regardless of queue item type. */
export function buildPeriodKey(payload: WaterLogInput): string {
  const { year, month, day, tehsil, village, settlement } = payload
  return [
    String(year),
    String(month),
    String(day),
    normalizePart(tehsil),
    normalizePart(village),
    normalizePart(settlement),
  ].join('|')
}

export type QueueIntent = 'submit' | 'draft'

export type QueueConflict = {
  existing: QueueItem
  title: string
  message: string
}

export function findQueueConflict(
  queue: QueueItem[],
  payload: WaterLogInput,
  intent: QueueIntent,
): QueueConflict | null {
  const periodKey = buildPeriodKey(payload)
  const matches = queue.filter(
    item => buildPeriodKey(item.payload) === periodKey,
  )
  if (!matches.length) return null

  const submission = matches.find(item => item.type === 'water')
  const draft = matches.find(item => item.type === 'water_draft')

  if (intent === 'submit') {
    if (submission) {
      return {
        existing: submission,
        title: 'Submission already queued',
        message:
          'A water log for this facility and date is already waiting to sync. Review the sync queue on Home or My Submissions, or wait until it uploads.',
      }
    }
    if (draft) {
      return {
        existing: draft,
        title: 'Draft already queued',
        message:
          'An offline draft for this facility and date is already in the sync queue. Wait for it to upload before submitting a new log.',
      }
    }
    return null
  }

  if (draft) {
    return {
      existing: draft,
      title: 'Draft already queued',
      message:
        'A draft for this facility and date is already queued offline. It will save to the server when you are back online.',
    }
  }
  if (submission) {
    return {
      existing: submission,
      title: 'Submission already queued',
      message:
        'A water log submission for this facility and date is already waiting to sync. Wait for it to upload before saving another draft.',
    }
  }
  return null
}

export function findQueuedForPeriod(
  queue: QueueItem[],
  payload: WaterLogInput,
): QueueItem | undefined {
  const periodKey = buildPeriodKey(payload)
  return queue.find(item => buildPeriodKey(item.payload) === periodKey)
}

export function buildQueueKey(item: QueueItem): string {
  const { year, month, day, tehsil, village, settlement } = item.payload
  return [
    item.type,
    String(year),
    String(month),
    String(day),
    normalizePart(tehsil),
    normalizePart(village),
    normalizePart(settlement),
  ].join('|')
}

export function createIdempotencyKey(type: QueueItem['type']): string {
  const rand = Math.random().toString(36).slice(2, 12)
  return `mrv-${type}-${Date.now()}-${rand}`
}

function toEpochMs(value: string): number {
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? 0 : ms
}

function normalizeQueueItem(item: QueueItem): QueueItem {
  const queueKey = item.queueKey ?? buildQueueKey(item)
  const idempotencyKey = item.idempotencyKey ?? createIdempotencyKey(item.type)
  return { ...item, queueKey, idempotencyKey }
}

function dedupeKeepLatest(items: QueueItem[]): QueueItem[] {
  const latestByKey = new Map<string, QueueItem>()
  for (const rawItem of items) {
    const item = normalizeQueueItem(rawItem)
    const key = item.queueKey ?? buildQueueKey(item)
    const existing = latestByKey.get(key)
    if (!existing) {
      latestByKey.set(key, item)
      continue
    }
    const isNewer = toEpochMs(item.createdAt) >= toEpochMs(existing.createdAt)
    if (isNewer) {
      latestByKey.set(key, item)
    }
  }
  return Array.from(latestByKey.values()).sort(
    (a, b) => toEpochMs(a.createdAt) - toEpochMs(b.createdAt),
  )
}

function errorStatus(error: unknown): number | undefined {
  const candidate = error as { response?: { status?: number } }
  return candidate.response?.status
}

function isRetryableError(error: unknown): boolean {
  const status = errorStatus(error)
  if (!status) return true
  if (status >= 500) return true
  return status === 408 || status === 425 || status === 429
}

async function persistQueue(queue: QueueItem[]): Promise<void> {
  await setJson(STORAGE_KEYS.submitQueue, dedupeKeepLatest(queue))
}

async function appendDropped(item: QueueItem, reason: string): Promise<void> {
  const dropped = (await getJson<QueueFailureRecord[]>(STORAGE_KEYS.submitQueueDropped)) ?? []
  dropped.unshift({
    ...item,
    droppedAt: nowIsoTimestamp(),
    dropReason: reason,
  })
  await setJson(STORAGE_KEYS.submitQueueDropped, dropped.slice(0, 100))
}

export async function getQueue(): Promise<QueueItem[]> {
  const rawQueue = (await getJson<QueueItem[]>(STORAGE_KEYS.submitQueue)) ?? []
  const normalized = dedupeKeepLatest(rawQueue)
  if (normalized.length !== rawQueue.length) {
    await persistQueue(normalized)
  }
  return normalized
}

export async function enqueue(item: QueueItem): Promise<void> {
  const queue = await getQueue()
  const next = dedupeKeepLatest([...queue, normalizeQueueItem(item)])
  await persistQueue(next)
}

export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch()
  return Boolean(state.isConnected && state.isInternetReachable !== false)
}

export async function drainQueue(): Promise<DrainQueueResult> {
  const result: DrainQueueResult = { processed: 0, synced: 0, retained: 0, dropped: 0 }
  const online = await isOnline()
  if (!online) return result

  let queue = await getQueue()
  if (!queue.length) return result

  // Process one item at a time and persist after each transition.
  while (queue.length > 0) {
    const item = queue[0]
    const nextAttempt = (item.attemptCount ?? 0) + 1
    const noBulkMeterInstalled = item.payload?.noBulkMeterInstalled === true
    result.processed += 1
    try {
      let imageUrl: string | undefined
      if (!noBulkMeterInstalled && item.evidence) {
        const up = await uploadEvidenceFile('water', item.evidence)
        const u = up.image_url
        const p = up.path
        imageUrl =
          typeof u === 'string' && u.trim()
            ? u.trim()
            : typeof p === 'string' && p.trim()
              ? p.trim()
              : undefined
      }
      if (item.type === 'water') {
        const keep =
          !noBulkMeterInstalled &&
          !imageUrl &&
          'existingImageUrl' in item &&
          typeof item.existingImageUrl === 'string' &&
          item.existingImageUrl.trim()
            ? item.existingImageUrl.trim()
            : undefined
        await saveWaterSupplyData(item.payload, {
          idempotencyKey: item.idempotencyKey,
          imageUrl: imageUrl ?? keep,
        })
      } else if (item.type === 'water_draft') {
        const keep =
          !noBulkMeterInstalled &&
          !imageUrl &&
          'existingImageUrl' in item &&
          typeof item.existingImageUrl === 'string' &&
          item.existingImageUrl.trim()
            ? item.existingImageUrl.trim()
            : undefined
        await saveWaterSupplyDraft(item.payload, {
          idempotencyKey: item.idempotencyKey,
          imageUrl: imageUrl ?? keep,
        })
      }
      queue = queue.slice(1)
      result.synced += 1
      await persistQueue(queue)
    } catch (error) {
      const retryable = isRetryableError(error)
      const status = errorStatus(error)
      const message = status ? `HTTP ${status}` : 'network_or_unknown_error'
      if (retryable) {
        const updatedItem: QueueItem = {
          ...item,
          attemptCount: nextAttempt,
          lastError: message,
          lastTriedAt: nowIsoTimestamp(),
        }
        queue = [updatedItem, ...queue.slice(1)]
        result.retained += 1
        await persistQueue(queue)
      } else {
        await appendDropped(
          {
            ...item,
            attemptCount: nextAttempt,
            lastError: message,
            lastTriedAt: nowIsoTimestamp(),
          },
          `non_retryable_${message}`,
        )
        queue = queue.slice(1)
        result.dropped += 1
        await persistQueue(queue)
      }
      break
    }
  }

  return result
}

