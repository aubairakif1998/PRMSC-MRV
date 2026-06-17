import type { QueueItem } from '../types/operator'

export function getQueueTypeLabel(type: QueueItem['type']): string {
  switch (type) {
    case 'water':
      return 'Water log submission'
    case 'water_draft':
      return 'Water log draft'
    default:
      return 'Queued item'
  }
}

export function formatQueueItemLocation(item: QueueItem): string {
  const { tehsil, village, settlement, year, month, day } = item.payload
  const parts = [tehsil, village, settlement].filter(Boolean)
  const location = parts.join(' · ')
  const date = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
  return location ? `${location} · ${date}` : date
}

export function formatQueueItemSummary(item: QueueItem): string {
  return `${getQueueTypeLabel(item.type)} — ${formatQueueItemLocation(item)}`
}

export function isDraftQueueItem(item: QueueItem): boolean {
  return item.type === 'water_draft'
}
