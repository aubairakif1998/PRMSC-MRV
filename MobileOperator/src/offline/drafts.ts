import { STORAGE_KEYS } from '../storage/keys'
import { getJson, setJson } from '../storage/jsonStorage'
import type { LogType, WaterLogInput } from '../types/operator'

export type DraftRecord = {
  id: string
  type: LogType
  payload: WaterLogInput
  createdAt: string
}

function keyByType(_type: LogType) {
  return STORAGE_KEYS.waterDrafts
}

export async function getDrafts(type: LogType): Promise<DraftRecord[]> {
  return (await getJson<DraftRecord[]>(keyByType(type))) ?? []
}

export async function getDraftById(type: LogType, draftId: string): Promise<DraftRecord | null> {
  const drafts = await getDrafts(type)
  return drafts.find((d) => d.id === draftId) ?? null
}

export async function saveDraft(type: LogType, payload: WaterLogInput): Promise<void> {
  const drafts = await getDrafts(type)
  drafts.unshift({
    id: `${type}-${Date.now()}`,
    type,
    payload,
    createdAt: new Date().toISOString(),
  })
  await setJson(keyByType(type), drafts.slice(0, 50))
}

export async function updateDraft(
  type: LogType,
  draftId: string,
  payload: WaterLogInput,
): Promise<void> {
  const drafts = await getDrafts(type)
  const next = drafts.map((d) => (d.id === draftId ? { ...d, payload } : d))
  await setJson(keyByType(type), next)
}

export async function deleteDraft(type: LogType, draftId: string): Promise<void> {
  const drafts = await getDrafts(type)
  await setJson(
    keyByType(type),
    drafts.filter((d) => d.id !== draftId),
  )
}

