import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
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
import type { EvidenceAsset, LogType, QueueItem, WaterLogInput } from '../types/operator'
import type { RootStackParamList } from '../navigation/types'
import { createIdempotencyKey, enqueue, isOnline } from '../offline/queue'
import { getQueue } from '../offline/queue'
import {
  getWaterDraftById,
  getWaterSupplyData,
  getWaterSystems,
  saveWaterSupplyData,
  saveWaterSupplyDraft,
  uploadEvidenceFile,
} from '../api/operator'
import { getApiErrorMessage } from '../lib/api-error'
import { SearchablePickerModal } from './SearchablePickerModal'
import { DatePickerField } from './DatePickerField'
import {
  AmPmTimePickerField,
  normalizeTo24hWithSeconds,
} from './AmPmTimePickerField'
import { MonthlyLogFormLoading } from '../features/shared/screenSkeletons'
import { LoadingOverlay } from './ui/loading-overlay'
import {
  getLocalIsoDateString,
  isIsoDatePastOrToday,
  isValidIsoDate,
} from '../utils/formValidation'

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

function parseIsoToYmd(iso: string): { y: number; m: number; d: number } | null {
  const t = iso.trim()
  if (!isValidIsoDate(t)) return null
  return {
    y: parseInt(t.slice(0, 4), 10),
    m: parseInt(t.slice(5, 7), 10),
    d: parseInt(t.slice(8, 10), 10),
  }
}

function isoFromYmd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function normalizeRemoteImageUrl(url: string): string {
  const u = url.trim()
  if (u.startsWith('http://')) return `https://${u.slice('http://'.length)}`
  return u
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
  disabled,
}: {
  label: string
  value?: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={[styles.select, disabled && styles.selectDisabled]}
        onPress={disabled ? undefined : onPress}
        disabled={disabled}
      >
        <Text style={[styles.selectText, disabled && styles.selectTextDisabled]}>
          {value || `Select ${label}`}
        </Text>
      </Pressable>
    </View>
  )
}

function RequiredLabel({ children }: { children: string }) {
  return (
    <Text style={styles.label}>
      {children}
      <Text style={styles.requiredMark}> *</Text>
    </Text>
  )
}

function isValidTimeOfDayInput(s: string): boolean {
  const t = s.trim()
  if (!t) return false
  return /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(t)
}

export function LogEntryForm({ type, draftId, systemId }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const currentYear = new Date().getFullYear()
  /** Full calendar date for `log_date` (defaults to today). */
  const [logDateIso, setLogDateIso] = useState(() => getLocalIsoDateString())
  const [tehsil, setTehsil] = useState('')
  const [village, setVillage] = useState('')
  const [settlement, setSettlement] = useState('')

  const [totalWater, setTotalWater] = useState('')
  const [pumpStartTime, setPumpStartTime] = useState('')
  const [pumpEndTime, setPumpEndTime] = useState('')
  const [existingRecordId, setExistingRecordId] = useState<string | null>(null)

  const periodLocked = false

  const [picker, setPicker] = useState<PickerState | null>(null)
  const [asset, setAsset] = useState<EvidenceAsset | null>(null)
  const [saving, setSaving] = useState(false)
  const [draftSaving, setDraftSaving] = useState(false)
  const [draftRefreshing, setDraftRefreshing] = useState(false)
  const [online, setOnline] = useState(true)
  const [queuedCount, setQueuedCount] = useState(0)
  const [activeDraftId, setActiveDraftId] = useState<string | null>(draftId ?? null)
  const [existingDraftImageUrl, setExistingDraftImageUrl] = useState<string | null>(null)
  const [draftImageLoadFailed, setDraftImageLoadFailed] = useState(false)
  const [facilityPrefetching, setFacilityPrefetching] = useState(
    () => systemId != null && systemId !== '',
  )
  const locationLocked = systemId != null && systemId !== ''

  const villageOptions = useMemo(() => {
    if (!tehsil) return []
    return LOCATION_DATA[tehsil] ?? []
  }, [tehsil])

  const settlementOptions = useMemo(() => {
    if (!village) return []
    return SETTLEMENT_DATA[village] ?? []
  }, [village])

  const payload = useMemo<WaterLogInput>(() => {
    const parts = parseIsoToYmd(logDateIso)
    const y = parts?.y ?? currentYear
    const m = parts?.m ?? new Date().getMonth() + 1
    const d = parts?.d ?? new Date().getDate()
    const hasTimes =
      pumpStartTime.trim().length > 0 && pumpEndTime.trim().length > 0
    return {
      year: y,
      month: m,
      day: d,
      tehsil,
      village,
      settlement: settlement || undefined,
      totalWaterPumping: totalWater ? Number(totalWater) : null,
      pumpStartTime: hasTimes ? normalizeTo24hWithSeconds(pumpStartTime) : null,
      pumpEndTime: hasTimes ? normalizeTo24hWithSeconds(pumpEndTime) : null,
    }
  }, [
    currentYear,
    logDateIso,
    pumpEndTime,
    pumpStartTime,
    settlement,
    tehsil,
    totalWater,
    village,
  ])

  useEffect(() => {
    isOnline().then(setOnline).catch(() => setOnline(false))
    getQueue().then((items) => setQueuedCount(items.length)).catch(() => {})
  }, [])

  const loadDraftFromServer = async (id: string) => {
    const draft = await getWaterDraftById(id)
    setDraftImageLoadFailed(false)
    setExistingDraftImageUrl(
      typeof draft.bulk_meter_image_url === 'string' && draft.bulk_meter_image_url.trim()
        ? normalizeRemoteImageUrl(draft.bulk_meter_image_url)
        : null,
    )
    const wp: WaterLogInput = {
      year: Number(draft.year ?? currentYear),
      month: Number(draft.month ?? new Date().getMonth() + 1),
      day: Number(draft.day ?? new Date().getDate()),
      tehsil: String(draft.tehsil ?? ''),
      village: String(draft.village ?? ''),
      settlement: draft.settlement ? String(draft.settlement) : undefined,
      totalWaterPumping:
        draft.total_water_pumped != null ? Number(draft.total_water_pumped) : null,
      pumpStartTime: draft.pump_start_time ?? null,
      pumpEndTime: draft.pump_end_time ?? null,
    }
    if (
      wp.year != null &&
      wp.month != null &&
      wp.day != null &&
      Number.isFinite(Number(wp.year)) &&
      Number.isFinite(Number(wp.month)) &&
      Number.isFinite(Number(wp.day))
    ) {
      setLogDateIso(isoFromYmd(Number(wp.year), Number(wp.month), Number(wp.day)))
    } else {
      setLogDateIso(getLocalIsoDateString())
    }
    setTehsil(wp.tehsil ?? '')
    setVillage(wp.village ?? '')
    setSettlement(wp.settlement ?? '')
    setTotalWater(wp.totalWaterPumping != null ? String(wp.totalWaterPumping) : '')
    setPumpStartTime(
      wp.pumpStartTime != null ? normalizeTo24hWithSeconds(String(wp.pumpStartTime)) : '',
    )
    setPumpEndTime(
      wp.pumpEndTime != null ? normalizeTo24hWithSeconds(String(wp.pumpEndTime)) : '',
    )
  }

  useEffect(() => {
    setActiveDraftId(draftId ?? null)
    if (!draftId) return
    loadDraftFromServer(draftId).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentYear, draftId, type])

  useEffect(() => {
    if (systemId == null || systemId === '') {
      setFacilityPrefetching(false)
      return
    }
    let cancelled = false
    setFacilityPrefetching(true)
    ;(async () => {
      try {
        const list = (await getWaterSystems()) as Array<Record<string, unknown>>
        const found = list.find((r) => String(r?.id) === String(systemId))
        if (cancelled) return
        if (!found) {
          Alert.alert(
            'Not assigned',
            'This water system is not assigned to your account. Please pick an assigned facility.',
            [{ text: 'OK', onPress: () => navigation.navigate('Assignments') }],
          )
          return
        }
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
  }, [draftId, systemId, navigation])

  // One row per system per calendar day: create-only in this screen (no edits).
  useEffect(() => {
    if (!systemId || draftId) return
    if (!tehsil || !village) return
    const parts = parseIsoToYmd(logDateIso)
    if (!parts) return

    let cancelled = false
    ;(async () => {
      try {
        const rows = await getWaterSupplyData({
          tehsil,
          village,
          settlement,
          year: parts.y,
        })
        if (cancelled) return
        const match = rows.find((r) => {
          if (!r || typeof r !== 'object') return false
          const rr = r as Record<string, unknown>
          const rd = rr.day != null ? Number(rr.day) : 1
          return (
            Number(rr.year) === parts.y &&
            Number(rr.month) === parts.m &&
            rd === parts.d
          )
        }) as Record<string, unknown> | undefined

        if (match?.id) {
          setExistingRecordId(String(match.id))
        } else {
          setExistingRecordId(null)
          if (!draftId && systemId) {
            setTotalWater('')
            setPumpStartTime('')
            setPumpEndTime('')
          }
        }
      } catch {
        setExistingRecordId(null)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [draftId, logDateIso, settlement, systemId, tehsil, village])

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
    const ld = logDateIso.trim()
    if (!isValidIsoDate(ld) || !isIsoDatePastOrToday(ld)) {
      Alert.alert(
        'Validation',
        'Choose a valid log date (today or an earlier day).',
      )
      return false
    }
    if (existingRecordId) {
      Alert.alert(
        'Already logged',
        'A log already exists for this facility and date. Please select a different date.',
      )
      return false
    }
    if (!tehsil || !village) {
      Alert.alert(
        'Validation',
        locationLocked
          ? 'Facility location is missing. Please reopen from Assignments and try again.'
          : 'Please select tehsil and village.',
      )
      return false
    }
    if (settlementOptions.length > 0 && !settlement) {
      Alert.alert('Validation', 'Please select settlement.')
      return false
    }
    if (!asset?.uri && !existingDraftImageUrl) {
      Alert.alert('Validation', 'Evidence image is mandatory. Please attach an image.')
      return false
    }
    if (!isValidNumberInput(totalWater)) {
      Alert.alert(
        'Validation',
        'Total Water Pumped (m³) is required and must be numeric.',
      )
      return false
    }
    const tStart = pumpStartTime.trim()
    const tEnd = pumpEndTime.trim()
    if (!tStart || !tEnd) {
      Alert.alert(
        'Validation',
        'Select pump start and end time (AM/PM picker). Operating hours are calculated on the server.',
      )
      return false
    }
    if (!isValidTimeOfDayInput(tStart) || !isValidTimeOfDayInput(tEnd)) {
      Alert.alert('Validation', 'Pump start and end times are invalid. Pick both again.')
      return false
    }
    return true
  }

  const onSaveDraft = async () => {
    const ld = logDateIso.trim()
    if (!isValidIsoDate(ld) || !isIsoDatePastOrToday(ld)) {
      Alert.alert('Draft', 'Choose a valid log date (today or earlier).')
      return
    }
    if (!tehsil || !village) {
      Alert.alert(
        'Draft',
        locationLocked
          ? 'Facility location is missing. Please reopen from Assignments and try again.'
          : 'Please choose tehsil and village before saving draft.',
      )
      return
    }
    if (settlementOptions.length > 0 && !settlement) {
      Alert.alert('Draft', 'Please choose settlement before saving draft.')
      return
    }
    if (!asset?.uri && !existingDraftImageUrl) {
      Alert.alert('Draft', 'Please attach an evidence image before saving a draft.')
      return
    }
    setDraftSaving(true)
    try {
      const currentlyOnline = await isOnline()
      if (!currentlyOnline) {
        await enqueue({
          id: `water_draft-${Date.now()}`,
          type: 'water_draft',
          payload,
          evidence: asset,
          existingImageUrl: existingDraftImageUrl ?? undefined,
          createdAt: new Date().toISOString(),
          idempotencyKey: createIdempotencyKey('water_draft'),
        })
        Alert.alert('Queued', 'No internet. Draft will be saved to the server when online.')
        navigation.navigate('Home')
        return
      }
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
      const res = await saveWaterSupplyDraft(payload, {
        idempotencyKey: createIdempotencyKey('water_draft'),
        imageUrl: imageUrl ?? (existingDraftImageUrl ?? undefined),
      })
      const firstId = res.record_ids?.[0]
      if (firstId) setActiveDraftId(String(firstId))
      if (imageUrl) setExistingDraftImageUrl(imageUrl)
      Alert.alert(activeDraftId ? 'Draft updated' : 'Draft saved', 'Saved to the server.')
      navigation.navigate('Home')
    } catch (e: unknown) {
      Alert.alert('Draft save failed', getApiErrorMessage(e, 'Please try again. Your form is still open.'))
    } finally {
      setDraftSaving(false)
    }
  }

  const makeQueueItem = (): QueueItem => ({
    id: `${type}-${Date.now()}`,
    type: 'water',
    payload: payload as WaterLogInput,
    evidence: asset,
    existingImageUrl: existingDraftImageUrl ?? undefined,
    createdAt: new Date().toISOString(),
    idempotencyKey: createIdempotencyKey('water'),
  })

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
    await saveWaterSupplyData(payload as WaterLogInput, { idempotencyKey, imageUrl })
  }

  const onSubmit = async () => {
    if (!validate()) return
    setSaving(true)
    const queueItem = makeQueueItem()
    try {
      const currentlyOnline = await isOnline()
      if (!currentlyOnline) {
        await enqueue(queueItem)
        const items = await getQueue()
        setQueuedCount(items.length)
        Alert.alert('Queued', 'No internet. Submission queued and will sync later.')
        navigation.navigate('Home')
      } else {
        await submitOnline(queueItem.idempotencyKey ?? createIdempotencyKey(type))
        Alert.alert('Success', 'Submitted successfully.')
        navigation.navigate('Home')
      }
    } catch (e: unknown) {
      // Only queue when there is no connectivity. If we are online but got a server error
      // (e.g. 400 validation), we should surface the error and keep the user on this screen.
      const stillOnline = await isOnline().catch(() => false)
      if (!stillOnline) {
        try {
          await enqueue(queueItem)
          const items = await getQueue()
          setQueuedCount(items.length)
          Alert.alert(
            'Queued',
            `${getApiErrorMessage(e, 'Request failed.')}\n\nNo internet. Submission queued and will sync later.`,
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
      } else {
        Alert.alert('Submit failed', getApiErrorMessage(e, 'Request failed. Please fix and retry.'))
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
      <LoadingOverlay
        visible={saving || draftSaving}
        title={draftSaving ? 'Saving draft…' : 'Submitting log…'}
        message="Please wait. Do not close the app."
      />

      <ScrollView
        style={styles.container}
        refreshControl={
          draftId ? (
            <RefreshControl
              refreshing={draftRefreshing}
              onRefresh={() => {
                if (!draftId) return
                setDraftRefreshing(true)
                loadDraftFromServer(draftId)
                  .catch(() => {})
                  .finally(() => setDraftRefreshing(false))
              }}
            />
          ) : undefined
        }
        contentContainerStyle={[styles.content, styles.scrollContent]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {facilityPrefetching ? (
          <MonthlyLogFormLoading variant={type} />
        ) : (
          <>
            <Text style={styles.title}>Water Supply Log</Text>

            {activeDraftId ? (
              <View style={styles.editingDraftBadge}>
                <Text style={styles.editingDraftBadgeText}>Editing saved draft</Text>
              </View>
            ) : null}

            {!draftId && systemId != null && systemId !== '' ? (
              <View style={styles.facilityBadge}>
                <Text style={styles.facilityBadgeText}>
                  Location from your registered facility
                </Text>
              </View>
            ) : null}

            <View style={[styles.statusBanner, !online && styles.statusBannerOffline]}>
              <Text
                style={[
                  styles.statusBannerText,
                  !online && styles.statusBannerTextOffline,
                ]}
              >
                {online
                  ? 'Online: submissions sync immediately.'
                  : 'Offline: submissions will be queued.'}
                {queuedCount ? ` Pending queue: ${queuedCount}` : ''}
              </Text>
            </View>

            <View style={styles.requirementsBox}>
              <Text style={styles.requirementsTitle}>Required for submit</Text>
              <Text style={styles.requirementsBody}>
                Log date (defaults to today), tehsil & village (and settlement if listed),
                total water pumped (m³), pump start & end time (server calculates operating
                hours), and bulk meter photo. Sent as{' '}
                <Text style={styles.requirementsMono}>monthlyData[]</Text> with{' '}
                <Text style={styles.requirementsMono}>day</Text> for{' '}
                <Text style={styles.requirementsMono}>log_date</Text>.
              </Text>
            </View>

            <View style={styles.field}>
              <RequiredLabel>Log date</RequiredLabel>
              <DatePickerField
                label=""
                value={logDateIso}
                onChange={setLogDateIso}
                placeholder={getLocalIsoDateString()}
                disabled={periodLocked}
              />
            </View>

            {locationLocked ? (
              <View style={styles.facilityBadge}>
                <Text style={styles.facilityBadgeText}>
                  {`Facility location: ${tehsil || '—'} · ${village || '—'}${
                    settlement ? ` · ${settlement}` : ''
                  }`}
                </Text>
              </View>
            ) : (
              <>
                <SelectField
                  label="Tehsil"
                  value={tehsil}
                  disabled={periodLocked}
                  onPress={() =>
                    setPicker({
                      title: 'Tehsil',
                      key: 'tehsil',
                      options: [...TEHSIL_OPTIONS],
                    })
                  }
                />

                <SelectField
                  label="Village"
                  value={village}
                  disabled={periodLocked}
                  onPress={() =>
                    setPicker({ title: 'Village', key: 'village', options: villageOptions })
                  }
                />

                <SelectField
                  label="Settlement"
                  value={settlement}
                  disabled={periodLocked}
                  onPress={() =>
                    setPicker({
                      title: 'Settlement',
                      key: 'settlement',
                      options: settlementOptions,
                    })
                  }
                />
              </>
            )}

            <Text style={[styles.helper, styles.waterMeterHint]}>
              Enter the monthly total from your water meter reading (m³). Sent as{' '}
              <Text style={styles.requirementsMono}>total_water_pumped</Text>.
            </Text>

            <View style={styles.field}>
              <RequiredLabel>Total water pumped (m³)</RequiredLabel>
              <TextInput
                value={totalWater}
                onChangeText={(value) => setTotalWater(sanitizeDecimalInput(value))}
                keyboardType="decimal-pad"
                style={styles.input}
              />
            </View>

            <Text style={styles.subsectionTitle}>Pump run</Text>
            <Text style={[styles.helper, styles.pumpIntro]}>
              Choose start and end using the clock (12-hour with AM/PM). The server sets{' '}
              <Text style={styles.requirementsMono}>pump_operating_hours</Text> from this
              interval.
            </Text>

            <View style={styles.field}>
              <RequiredLabel>Pump start</RequiredLabel>
              <AmPmTimePickerField
                label=""
                value={pumpStartTime}
                onChange={setPumpStartTime}
                placeholder="Tap to select start time"
              />
            </View>

            <View style={styles.field}>
              <RequiredLabel>Pump end</RequiredLabel>
              <AmPmTimePickerField
                label=""
                value={pumpEndTime}
                onChange={setPumpEndTime}
                placeholder="Tap to select end time"
              />
            </View>

            {existingRecordId ? (
              <View style={styles.facilityBadge}>
                <Text style={styles.facilityBadgeText}>
                  A log already exists for this facility and date. Pick another date to create a
                  new log.
                </Text>
              </View>
            ) : null}

            <View style={styles.field}>
              <RequiredLabel>Bulk meter evidence (photo)</RequiredLabel>
              <Text style={styles.helper}>Upload a photo of the bulk meter.</Text>
              {asset?.uri ? (
                <View style={styles.existingPhotoWrap}>
                  <Image
                    source={{ uri: asset.uri }}
                    style={styles.existingPhoto}
                    resizeMode="cover"
                  />
                  <Text style={styles.helper}>New photo selected (will replace saved photo)</Text>
                </View>
              ) : existingDraftImageUrl ? (
                <View style={styles.existingPhotoWrap}>
                  <Image
                    source={{ uri: existingDraftImageUrl }}
                    style={styles.existingPhoto}
                    resizeMode="cover"
                    onError={() => setDraftImageLoadFailed(true)}
                  />
                  {draftImageLoadFailed ? (
                    <Text style={[styles.helper, styles.photoError]}>
                      Could not load saved photo. Tap Camera/Gallery to replace.
                    </Text>
                  ) : (
                    <Text style={styles.helper}>
                      Current saved photo (tap Camera/Gallery to replace)
                    </Text>
                  )}
                </View>
              ) : null}
              <View style={styles.row}>
                <Pressable style={styles.actionBtn} onPress={openCamera}>
                  <Text style={styles.actionText}>Camera</Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={openGallery}>
                  <Text style={styles.actionText}>Gallery</Text>
                </Pressable>
              </View>
              <Text style={styles.helper}>
                {asset?.fileName || asset?.uri
                  ? `New: ${asset?.fileName ?? 'image'}`
                  : existingDraftImageUrl
                    ? 'Using current saved photo'
                    : 'No image selected'}
              </Text>
            </View>

            <View style={styles.row}>
              <Pressable
                style={[styles.submitBtn, styles.secondary]}
                onPress={onSaveDraft}
                disabled={saving || draftSaving}
              >
                <Text style={[styles.submitText, styles.secondaryText]}>Save Draft</Text>
              </Pressable>
              <Pressable style={styles.submitBtn} onPress={onSubmit} disabled={saving}>
                <Text style={styles.submitText}>
                  {saving ? 'Saving...' : online ? 'Submit' : 'Queue Submit'}
                </Text>
              </Pressable>
            </View>

            {!locationLocked ? (
              <SearchablePickerModal
                visible={Boolean(picker)}
                title={picker?.title ?? ''}
                options={picker?.options ?? []}
                searchPlaceholder="Search list…"
                onClose={() => setPicker(null)}
                onSelect={(option) => {
                  if (!picker) return
                  if (picker.key === 'tehsil') {
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
            ) : null}
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
  requirementsBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  requirementsTitle: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 13,
    marginBottom: 6,
  },
  requirementsBody: { color: '#475569', fontSize: 12, lineHeight: 18 },
  requirementsMono: { fontSize: 11, color: '#334155', fontWeight: '600' },
  subsectionTitle: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 15,
    marginTop: 8,
    marginBottom: 4,
  },
  requiredMark: { color: '#dc2626', fontWeight: '900' },
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
  selectDisabled: { backgroundColor: '#f1f5f9', opacity: 0.85 },
  selectTextDisabled: { color: '#64748b' },
  inputDisabled: { backgroundColor: '#f1f5f9', color: '#64748b' },
  row: { flexDirection: 'row', gap: 10 },
  waterMeterHint: { marginTop: 4, marginBottom: 10, fontSize: 13 },
  pumpIntro: { marginBottom: 8 },
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
  existingPhotoWrap: { marginTop: 8, marginBottom: 8 },
  existingPhoto: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
  },
  photoError: { color: '#b91c1c', fontWeight: '700' },
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

