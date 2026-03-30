import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { launchCamera, launchImageLibrary } from 'react-native-image-picker'

import { LOCATION_DATA, SETTLEMENT_DATA, TEHSIL_OPTIONS } from '../utils/locationData'
import type { EvidenceAsset, LogType, QueueItem, SolarLogInput, WaterLogInput } from '../types/operator'
import type { RootStackParamList } from '../navigation/types'
import { createIdempotencyKey, enqueue, isOnline } from '../offline/queue'
import { getQueue } from '../offline/queue'
import { deleteDraft, getDraftById, saveDraft, updateDraft } from '../offline/drafts'
import {
  getSolarSystems,
  getWaterSystems,
  saveSolarSupplyData,
  saveWaterSupplyData,
  uploadEvidenceFile,
} from '../api/operator'
import { getApiErrorMessage } from '../lib/api-error'
import { SearchablePickerModal } from './SearchablePickerModal'
import { MonthlyLogFormLoading } from '../screens/screenSkeletons'
import { isYearMonthNotAfterNow } from '../utils/formValidation'

type Props = {
  type: LogType
  draftId?: string
  /** Prefill location from a registered facility (same as web `?system=`). */
  systemId?: string | number
}

type PickerState = {
  title: string
  key: 'tehsil' | 'village' | 'settlement'
  options: string[]
}

const MONTHS = [
  { label: 'January', value: 1 },
  { label: 'February', value: 2 },
  { label: 'March', value: 3 },
  { label: 'April', value: 4 },
  { label: 'May', value: 5 },
  { label: 'June', value: 6 },
  { label: 'July', value: 7 },
  { label: 'August', value: 8 },
  { label: 'September', value: 9 },
  { label: 'October', value: 10 },
  { label: 'November', value: 11 },
  { label: 'December', value: 12 },
]

function sanitizeIntegerInput(value: string): string {
  return value.replace(/\D/g, '')
}

function sanitizeDecimalInput(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, '')
  const [whole, ...rest] = cleaned.split('.')
  if (!rest.length) return whole
  return `${whole}.${rest.join('').replace(/\./g, '')}`
}

function isValidNumberInput(value: string): boolean {
  if (!value.trim()) return false
  const parsed = Number(value)
  return Number.isFinite(parsed)
}

function SelectField({
  label,
  value,
  onPress,
}: {
  label: string
  value?: string
  onPress: () => void
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.select} onPress={onPress}>
        <Text style={styles.selectText}>{value || `Select ${label}`}</Text>
      </Pressable>
    </View>
  )
}

export function LogEntryForm({ type, draftId, systemId }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(String(currentYear))
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [tehsil, setTehsil] = useState('')
  const [village, setVillage] = useState('')
  const [settlement, setSettlement] = useState('')

  const [totalWater, setTotalWater] = useState('')
  const [energyConsumed, setEnergyConsumed] = useState('')
  const [energyExported, setEnergyExported] = useState('')

  const [picker, setPicker] = useState<PickerState | null>(null)
  const [asset, setAsset] = useState<EvidenceAsset | null>(null)
  const [saving, setSaving] = useState(false)
  const [online, setOnline] = useState(true)
  const [queuedCount, setQueuedCount] = useState(0)
  const [activeDraftId, setActiveDraftId] = useState<string | null>(draftId ?? null)
  const [facilityPrefetching, setFacilityPrefetching] = useState(
    () => systemId != null && systemId !== '' && !draftId,
  )

  const villageOptions = useMemo(() => {
    if (!tehsil) return []
    return LOCATION_DATA[tehsil] ?? []
  }, [tehsil])

  const settlementOptions = useMemo(() => {
    if (!village) return []
    return SETTLEMENT_DATA[village] ?? []
  }, [village])

  const payload = useMemo<WaterLogInput | SolarLogInput>(() => {
    if (type === 'water') {
      return {
        year: Number(year) || currentYear,
        month,
        tehsil,
        village,
        settlement: settlement || undefined,
        totalWaterPumping: totalWater ? Number(totalWater) : null,
      }
    }
    return {
        year: Number(year) || currentYear,
      month,
      tehsil,
      village,
      settlement: settlement || undefined,
      energyConsumedFromGrid: energyConsumed ? Number(energyConsumed) : null,
      energyExportedToGrid: energyExported ? Number(energyExported) : null,
    }
  }, [
    energyConsumed,
    energyExported,
    month,
    currentYear,
    settlement,
    tehsil,
    totalWater,
    type,
    village,
    year,
  ])

  useEffect(() => {
    isOnline().then(setOnline).catch(() => setOnline(false))
    getQueue().then((items) => setQueuedCount(items.length)).catch(() => {})
  }, [])

  useEffect(() => {
    setActiveDraftId(draftId ?? null)
    if (!draftId) return
    getDraftById(type, draftId)
      .then((draft) => {
        if (!draft) return
        const p = draft.payload
        setYear(String(p.year ?? currentYear))
        setMonth(Number(p.month ?? new Date().getMonth() + 1))
        setTehsil(p.tehsil ?? '')
        setVillage(p.village ?? '')
        setSettlement(p.settlement ?? '')
        if (type === 'water') {
          const wp = p as WaterLogInput
          setTotalWater(wp.totalWaterPumping != null ? String(wp.totalWaterPumping) : '')
        } else {
          const sp = p as SolarLogInput
          setEnergyConsumed(sp.energyConsumedFromGrid != null ? String(sp.energyConsumedFromGrid) : '')
          setEnergyExported(sp.energyExportedToGrid != null ? String(sp.energyExportedToGrid) : '')
        }
      })
      .catch(() => {})
  }, [currentYear, draftId, type])

  useEffect(() => {
    if (draftId) {
      setFacilityPrefetching(false)
      return
    }
    if (systemId == null || systemId === '') {
      setFacilityPrefetching(false)
      return
    }
    let cancelled = false
    setFacilityPrefetching(true)
    ;(async () => {
      try {
        const list =
          type === 'water'
            ? ((await getWaterSystems()) as Array<Record<string, unknown>>)
            : ((await getSolarSystems()) as Array<Record<string, unknown>>)
        const found = list.find((r) => String(r?.id) === String(systemId))
        if (!found || cancelled) return
        setTehsil(typeof found.tehsil === 'string' ? found.tehsil : '')
        setVillage(typeof found.village === 'string' ? found.village : '')
        const s = found.settlement
        setSettlement(typeof s === 'string' ? s : s == null ? '' : String(s))
      } catch {
        // keep manual entry
      } finally {
        if (!cancelled) setFacilityPrefetching(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [draftId, systemId, type])

  const openCamera = async () => {
    const res = await launchCamera({ mediaType: 'photo', quality: 0.8 })
    const first = res.assets?.[0]
    if (first?.uri) setAsset({ uri: first.uri, fileName: first.fileName, type: first.type })
  }

  const openGallery = async () => {
    const res = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 })
    const first = res.assets?.[0]
    if (first?.uri) setAsset({ uri: first.uri, fileName: first.fileName, type: first.type })
  }

  const validate = () => {
    if (!/^\d{4}$/.test(year)) {
      Alert.alert('Validation', 'Please enter a valid 4-digit year.')
      return false
    }
    if (month < 1 || month > 12) {
      Alert.alert('Validation', 'Please select a valid month.')
      return false
    }
    const yNum = Number(year)
    if (!Number.isFinite(yNum)) {
      Alert.alert('Validation', 'Please enter a valid year.')
      return false
    }
    if (!isYearMonthNotAfterNow(yNum, month)) {
      Alert.alert(
        'Validation',
        'Reporting period cannot be in the future. Choose the current month or an earlier one.',
      )
      return false
    }
    if (!tehsil || !village) {
      Alert.alert('Validation', 'Please select tehsil and village.')
      return false
    }
    if (settlementOptions.length > 0 && !settlement) {
      Alert.alert('Validation', 'Please select settlement.')
      return false
    }
    if (!asset?.uri) {
      Alert.alert('Validation', 'Evidence image is mandatory. Please attach an image.')
      return false
    }
    if (type === 'water') {
      if (!isValidNumberInput(totalWater)) {
        Alert.alert(
          'Validation',
          'Total Water Pumped (m³) is required and must be numeric.',
        )
        return false
      }
    } else {
      if (!isValidNumberInput(energyConsumed)) {
        Alert.alert('Validation', 'Energy consumed from grid is required and must be numeric.')
        return false
      }
      if (!isValidNumberInput(energyExported)) {
        Alert.alert('Validation', 'Energy exported to grid is required and must be numeric.')
        return false
      }
    }
    return true
  }

  const onSaveDraft = async () => {
    if (!/^\d{4}$/.test(year)) {
      Alert.alert('Draft', 'Enter a valid 4-digit year before saving draft.')
      return
    }
    const yDraft = Number(year)
    if (!isYearMonthNotAfterNow(yDraft, month)) {
      Alert.alert('Draft', 'Reporting period cannot be in the future.')
      return
    }
    if (!tehsil || !village) {
      Alert.alert('Draft', 'Please choose tehsil and village before saving draft.')
      return
    }
    if (settlementOptions.length > 0 && !settlement) {
      Alert.alert('Draft', 'Please choose settlement before saving draft.')
      return
    }
    try {
      if (activeDraftId) {
        await updateDraft(type, activeDraftId, payload)
        Alert.alert('Draft updated', 'Your changes were saved.')
      } else {
        await saveDraft(type, payload)
        Alert.alert('Draft saved', 'Saved locally on device.')
      }
      navigation.navigate('Home')
    } catch (e: unknown) {
      Alert.alert('Draft save failed', getApiErrorMessage(e, 'Please try again. Your form is still open.'))
    }
  }

  const makeQueueItem = (): QueueItem =>
    type === 'water'
      ? {
          id: `${type}-${Date.now()}`,
          type: 'water',
          payload: payload as WaterLogInput,
          evidence: asset,
          createdAt: new Date().toISOString(),
          idempotencyKey: createIdempotencyKey('water'),
        }
      : {
          id: `${type}-${Date.now()}`,
          type: 'solar',
          payload: payload as SolarLogInput,
          evidence: asset,
          createdAt: new Date().toISOString(),
          idempotencyKey: createIdempotencyKey('solar'),
        }

  const submitOnline = async (idempotencyKey: string) => {
    let imageUrl: string | undefined
    if (asset) {
      const up = await uploadEvidenceFile(type, asset)
      const u = up.image_url
      const p = up.path
      imageUrl =
        typeof u === 'string' && u.trim()
          ? u.trim()
          : typeof p === 'string' && p.trim()
            ? p.trim()
            : undefined
    }
    if (type === 'water') {
      await saveWaterSupplyData(payload as WaterLogInput, { idempotencyKey, imageUrl })
    } else {
      await saveSolarSupplyData(payload as SolarLogInput, { idempotencyKey, imageUrl })
    }
  }

  const onSubmit = async () => {
    if (!validate()) return
    setSaving(true)
    const queueItem = makeQueueItem()
    try {
      const currentlyOnline = await isOnline()
      if (!currentlyOnline) {
        await enqueue(queueItem)
        if (activeDraftId) {
          await deleteDraft(type, activeDraftId)
          setActiveDraftId(null)
        }
        const items = await getQueue()
        setQueuedCount(items.length)
        Alert.alert('Queued', 'No internet. Submission queued and will sync later.')
        navigation.navigate('Home')
      } else {
        await submitOnline(queueItem.idempotencyKey ?? createIdempotencyKey(type))
        if (activeDraftId) {
          await deleteDraft(type, activeDraftId)
          setActiveDraftId(null)
        }
        Alert.alert('Success', 'Submitted successfully.')
        navigation.navigate('Home')
      }
    } catch (e: unknown) {
      try {
        await enqueue(queueItem)
        if (activeDraftId) {
          await deleteDraft(type, activeDraftId)
          setActiveDraftId(null)
        }
        const items = await getQueue()
        setQueuedCount(items.length)
        Alert.alert(
          'Submit failed',
          `${getApiErrorMessage(e, 'Request failed.')}\n\nSaved to queue. It will retry when online.`,
        )
        navigation.navigate('Home')
      } catch {
        Alert.alert(
          'Critical error',
          getApiErrorMessage(
            e,
            'Submission could not be sent or queued. Please retry before leaving this screen.',
          ),
        )
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.kav}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, styles.scrollContent]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
      {facilityPrefetching ? (
        <MonthlyLogFormLoading variant={type} />
      ) : (
        <>
      <Text style={styles.title}>{type === 'water' ? 'Water Supply Log' : 'Solar Log'}</Text>
      {activeDraftId ? (
        <View style={styles.editingDraftBadge}>
          <Text style={styles.editingDraftBadgeText}>Editing saved draft</Text>
        </View>
      ) : null}
      {!draftId && systemId != null && systemId !== '' ? (
        <View style={styles.facilityBadge}>
          <Text style={styles.facilityBadgeText}>Location from your registered facility</Text>
        </View>
      ) : null}
      <View style={[styles.statusBanner, !online && styles.statusBannerOffline]}>
        <Text style={[styles.statusBannerText, !online && styles.statusBannerTextOffline]}>
          {online ? 'Online: submissions sync immediately.' : 'Offline: submissions will be queued.'}
          {queuedCount ? ` Pending queue: ${queuedCount}` : ''}
        </Text>
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Year</Text>
        <TextInput
          value={year}
          onChangeText={(value) => setYear(sanitizeIntegerInput(value))}
          keyboardType="number-pad"
          maxLength={4}
          style={styles.input}
        />
      </View>

      <SelectField
        label="Month"
        value={MONTHS.find((m) => m.value === month)?.label}
        onPress={() => setPicker({ title: 'Month', key: 'settlement', options: MONTHS.map((m) => m.label) })}
      />

      <SelectField
        label="Tehsil"
        value={tehsil}
        onPress={() => setPicker({ title: 'Tehsil', key: 'tehsil', options: [...TEHSIL_OPTIONS] })}
      />
      <SelectField
        label="Village"
        value={village}
        onPress={() => setPicker({ title: 'Village', key: 'village', options: villageOptions })}
      />
      <SelectField
        label="Settlement"
        value={settlement}
        onPress={() => setPicker({ title: 'Settlement', key: 'settlement', options: settlementOptions })}
      />

      {type === 'water' ? (
        <>
          <Text style={[styles.helper, styles.waterMeterHint]}>
            Enter the monthly total from your water meter reading (m³).
          </Text>
          <View style={styles.field}>
            <Text style={styles.label}>Total Water Pumped (m³)</Text>
            <TextInput
              value={totalWater}
              onChangeText={(value) => setTotalWater(sanitizeDecimalInput(value))}
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </View>
        </>
      ) : (
        <>
          <View style={styles.field}>
            <Text style={styles.label}>Energy Consumed From Grid (kWh)</Text>
            <TextInput
              value={energyConsumed}
              onChangeText={(value) => setEnergyConsumed(sanitizeDecimalInput(value))}
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Energy Exported To Grid (kWh)</Text>
            <TextInput
              value={energyExported}
              onChangeText={(value) => setEnergyExported(sanitizeDecimalInput(value))}
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </View>
        </>
      )}

      <View style={styles.field}>
        <Text style={styles.label}>Supporting Evidence</Text>
        <View style={styles.row}>
          <Pressable style={styles.actionBtn} onPress={openCamera}>
            <Text style={styles.actionText}>Camera</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={openGallery}>
            <Text style={styles.actionText}>Gallery</Text>
          </Pressable>
        </View>
        <Text style={styles.helper}>{asset?.fileName || asset?.uri || 'No image selected'}</Text>
      </View>

      <View style={styles.row}>
        <Pressable style={[styles.submitBtn, styles.secondary]} onPress={onSaveDraft}>
          <Text style={[styles.submitText, styles.secondaryText]}>Save Draft</Text>
        </Pressable>
        <Pressable style={styles.submitBtn} onPress={onSubmit} disabled={saving}>
          <Text style={styles.submitText}>{saving ? 'Saving...' : online ? 'Submit' : 'Queue Submit'}</Text>
        </Pressable>
      </View>

      <SearchablePickerModal
        visible={Boolean(picker)}
        title={picker?.title ?? ''}
        options={picker?.options ?? []}
        searchPlaceholder="Search list…"
        onClose={() => setPicker(null)}
        onSelect={(option) => {
          if (!picker) return
          if (picker.title === 'Month') {
            const selected = MONTHS.find((m) => m.label === option)
            if (selected) setMonth(selected.value)
          } else if (picker.key === 'tehsil') {
            setTehsil(option)
            setVillage('')
            setSettlement('')
          } else if (picker.key === 'village') {
            setVillage(option)
            setSettlement('')
          } else {
            setSettlement(option)
          }
        }}
      />
        </>
      )}
    </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  kav: { flex: 1 },
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, gap: 8 },
  /** Extra bottom padding so the last fields and buttons stay above the keyboard when scrolling. */
  scrollContent: { flexGrow: 1, paddingBottom: 120 },
  title: { color: '#0f172a', fontSize: 22, fontWeight: '900', marginBottom: 8 },
  editingDraftBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ede9fe',
    borderColor: '#c4b5fd',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 8,
  },
  editingDraftBadgeText: { color: '#6d28d9', fontWeight: '800', fontSize: 12 },
  facilityBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ecfdf5',
    borderColor: '#6ee7b7',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 8,
  },
  facilityBadgeText: { color: '#047857', fontWeight: '800', fontSize: 12 },
  statusBanner: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 10,
    padding: 9,
    marginBottom: 10,
  },
  statusBannerOffline: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  statusBannerText: { color: '#1d4ed8', fontWeight: '700', fontSize: 12 },
  statusBannerTextOffline: { color: '#b91c1c' },
  field: { marginBottom: 10 },
  label: { color: '#475569', marginBottom: 6, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    color: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  select: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  selectText: { color: '#0f172a' },
  row: { flexDirection: 'row', gap: 10 },
  waterMeterHint: { marginTop: 4, marginBottom: 10, fontSize: 13 },
  actionBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionText: { color: '#1d4ed8', fontWeight: '800' },
  helper: { marginTop: 6, color: '#64748b', fontSize: 12 },
  submitBtn: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    backgroundColor: '#38bdf8',
  },
  secondary: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1' },
  submitText: { color: '#0b1220', fontWeight: '900' },
  secondaryText: { color: '#334155' },
})

