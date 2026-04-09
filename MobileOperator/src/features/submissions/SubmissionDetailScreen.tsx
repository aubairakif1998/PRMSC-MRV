import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert as RNAlert,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { launchCamera, launchImageLibrary } from 'react-native-image-picker';

import {
  getSubmissionDetail,
  saveWaterSupplyData,
  uploadEvidenceFile,
} from '../../api/operator';
import { getApiErrorMessage } from '../../lib/api-error';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Separator } from '../../components/ui/separator';
import { SubmissionDetailLoading } from '../shared/screenSkeletons';
import { Text } from '../../components/ui/text';
import type { RootStackParamList } from '../../navigation/types';
import { AlertCircle } from 'lucide-react-native';
import type { EvidenceAsset, WaterLogInput } from '../../types/operator';
import { createIdempotencyKey } from '../../offline/queue';
import { LoadingOverlay } from '../../components/ui/loading-overlay';
import {
  AmPmTimePickerField,
  normalizeTo24hWithSeconds,
} from '../../components/AmPmTimePickerField';

type Props = NativeStackScreenProps<RootStackParamList, 'SubmissionDetail'>;

function fmt(v: unknown): string {
  if (v == null || v === '') return '—';
  if (
    typeof v === 'string' ||
    typeof v === 'number' ||
    typeof v === 'boolean'
  ) {
    return String(v);
  }
  return JSON.stringify(v);
}

function fmtDate(iso: unknown): string {
  if (iso == null || iso === '') return '—';
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatSubmissionType(raw: unknown): string {
  const s = String(raw ?? '—');
  if (s === '—') return s;
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getStatusVariant(status: string) {
  const s = status.toLowerCase();
  if (s === 'verified' || s === 'approved') return 'secondary' as const;
  if (s === 'rejected') return 'destructive' as const;
  if (s === 'submitted' || s === 'under_review') return 'default' as const;
  return 'outline' as const;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="gap-0.5">
      <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Text>
      <Text className="text-sm text-foreground">{value}</Text>
    </View>
  );
}

function isHttpUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
}

function EvidenceImageBlock({ label, url }: { label: string; url: unknown }) {
  const [failed, setFailed] = useState(false);
  const raw = typeof url === 'string' ? url.trim() : '';

  if (!raw) {
    return <DetailRow label={label} value="—" />;
  }

  if (!isHttpUrl(raw)) {
    return <DetailRow label={label} value={raw} />;
  }

  if (failed) {
    return (
      <View className="gap-2">
        <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </Text>
        <Text className="text-sm text-destructive">
          Could not load image preview.
        </Text>
        <Text
          className="text-xs text-muted-foreground"
          numberOfLines={4}
          selectable
        >
          {raw}
        </Text>
        <Pressable onPress={() => Linking.openURL(raw)}>
          <Text className="text-sm font-semibold text-primary">Open link</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="gap-2">
      <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Text>
      <Image
        accessibilityLabel={label}
        source={{ uri: raw }}
        style={evidenceStyles.image}
        resizeMode="contain"
        onError={() => setFailed(true)}
      />
      <Pressable
        onPress={() => Linking.openURL(raw).catch(() => {})}
        accessibilityRole="button"
        accessibilityLabel="Open evidence image in browser"
      >
        <Text className="text-xs font-semibold text-primary">
          Open full size in browser
        </Text>
      </Pressable>
    </View>
  );
}

const evidenceStyles = StyleSheet.create({
  image: {
    width: '100%',
    height: 260,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
});

const editStyles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    color: '#0f172a',
  },
});

export function SubmissionDetailScreen({ route }: Props) {
  const { submissionId } = route.params;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [payload, setPayload] = useState<Awaited<
    ReturnType<typeof getSubmissionDetail>
  > | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await getSubmissionDetail(submissionId);
      setPayload(data);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Could not load submission.'));
      setPayload(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [submissionId]);

  const retry = useCallback(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const sub = (payload?.submission ?? {}) as Record<string, unknown>;
  const record = (payload?.record_data ?? {}) as Record<string, unknown>;
  const system = (record.system ?? {}) as Record<string, unknown>;
  const audit = Array.isArray(payload?.audit_trail)
    ? (payload?.audit_trail as Array<Record<string, unknown>>)
    : [];

  const statusStr = String(sub.status ?? '—');
  const canEditResubmit = statusStr.toLowerCase() === 'reverted_back';

  const [totalWater, setTotalWater] = useState('');
  const [pumpStart, setPumpStart] = useState('');
  const [pumpEnd, setPumpEnd] = useState('');
  const [asset, setAsset] = useState<EvidenceAsset | null>(null);

  const existingImageUrl = useMemo(() => {
    const raw = record.bulk_meter_image_url;
    return typeof raw === 'string' && raw.trim() ? raw.trim() : '';
  }, [record.bulk_meter_image_url]);

  useEffect(() => {
    if (!canEditResubmit) return;
    const tw = record.total_water_pumped;
    setTotalWater(tw != null && String(tw) !== '' ? String(tw) : '');
    const pst = record.pump_start_time;
    const pet = record.pump_end_time;
    setPumpStart(typeof pst === 'string' && pst.trim() ? pst.trim() : '');
    setPumpEnd(typeof pet === 'string' && pet.trim() ? pet.trim() : '');
    setAsset(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId, canEditResubmit]);

  function sanitizeDecimalInput(value: string): string {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const [whole, ...rest] = cleaned.split('.');
    if (!rest.length) return whole;
    return `${whole}.${rest.join('').replace(/\./g, '')}`;
  }

  function isValidNumberInput(value: string): boolean {
    if (!value.trim()) return false;
    const parsed = Number(value);
    return Number.isFinite(parsed);
  }

  const openCamera = async () => {
    const res = await launchCamera({ mediaType: 'photo', quality: 0.8 });
    const first = res.assets?.[0];
    if (first?.uri)
      setAsset({ uri: first.uri, fileName: first.fileName, type: first.type });
  };

  const openGallery = async () => {
    const res = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
    const first = res.assets?.[0];
    if (first?.uri)
      setAsset({ uri: first.uri, fileName: first.fileName, type: first.type });
  };

  const onEditResubmit = async () => {
    const sys = (record.system ?? {}) as Record<string, unknown>;
    const tehsil = typeof sys.tehsil === 'string' ? sys.tehsil : '';
    const village = typeof sys.village === 'string' ? sys.village : '';
    const settlement =
      typeof sys.settlement === 'string'
        ? sys.settlement
        : sys.settlement == null
        ? ''
        : String(sys.settlement);

    const year = Number(record.year);
    const month = Number(record.month);
    const day = Number((record as Record<string, unknown>).day);

    if (
      !tehsil ||
      !village ||
      !Number.isFinite(year) ||
      !Number.isFinite(month) ||
      !Number.isFinite(day)
    ) {
      RNAlert.alert(
        'Cannot resubmit',
        'Missing system or date information for this record.',
      );
      return;
    }
    if (!isValidNumberInput(totalWater)) {
      RNAlert.alert('Validation', 'Total water pumped must be numeric.');
      return;
    }
    if (!pumpStart.trim() || !pumpEnd.trim()) {
      RNAlert.alert('Validation', 'Select pump start and end time.');
      return;
    }
    if (!asset?.uri && !existingImageUrl) {
      RNAlert.alert(
        'Validation',
        'Please attach a meter image (or keep existing).',
      );
      return;
    }

    setSaving(true);
    try {
      let imageUrl = existingImageUrl || undefined;
      if (asset) {
        const up = await uploadEvidenceFile('water', asset);
        const u = up.image_url;
        const p = up.path;
        imageUrl =
          typeof u === 'string' && u.trim()
            ? u.trim()
            : typeof p === 'string' && p.trim()
            ? p.trim()
            : imageUrl;
      }

      const input: WaterLogInput = {
        year: Math.trunc(year),
        month: Math.trunc(month),
        day: Math.trunc(day),
        tehsil,
        village,
        settlement: settlement || undefined,
        totalWaterPumping: Number(totalWater),
        pumpStartTime: normalizeTo24hWithSeconds(pumpStart),
        pumpEndTime: normalizeTo24hWithSeconds(pumpEnd),
      };

      await saveWaterSupplyData(input, {
        idempotencyKey: createIdempotencyKey('water'),
        imageUrl,
      });

      RNAlert.alert('Submitted', 'Your changes were submitted successfully.');
      setAsset(null);
      setRefreshing(true);
      await load();
    } catch (e: unknown) {
      RNAlert.alert('Submit failed', getApiErrorMessage(e, 'Request failed.'));
    } finally {
      setSaving(false);
      setRefreshing(false);
    }
  };

  if (loading && !payload) {
    return <SubmissionDetailLoading />;
  }

  if (error && !payload?.submission) {
    return (
      <View className="flex-1 bg-muted/30 p-4">
        <Alert icon={AlertCircle} variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button className="mt-4" onPress={retry}>
          <Text>Try again</Text>
        </Button>
      </View>
    );
  }

  return (
    // <KeyboardAvoidingView
    //   className="flex-1 bg-muted/30"
    //   style={{ flex: 1 }}
    //   behavior={Platform.OS === "ios" ? "padding" : undefined}
    //   keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    // >
    <ScrollView
      className="flex-1 bg-muted/30"
      contentContainerClassName="gap-4 p-4 pb-10"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
        />
      }
    >
      <LoadingOverlay
        visible={saving}
        title="Submitting…"
        message="Please wait."
      />
      <Card>
        <CardHeader className="gap-2">
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg">
              {formatSubmissionType(sub.submission_type)}
            </CardTitle>
            <Badge variant={getStatusVariant(statusStr)}>{statusStr}</Badge>
          </View>
          <Text className="font-mono text-xs text-muted-foreground">
            ID {fmt(sub.id)}
          </Text>
          <CardDescription>
            Operator: {fmt(sub.operator_name)} ({fmt(sub.operator_email)})
          </CardDescription>
        </CardHeader>
      </Card>

      {canEditResubmit ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edit & resubmit</CardTitle>
            <CardDescription>
              Update pump start/end time, total water pumped and meter image,
              then resubmit.
            </CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="gap-4 pt-4">
            <View className="gap-2">
              <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Total water pumped (m³)
              </Text>
              <TextInput
                value={totalWater}
                onChangeText={v => setTotalWater(sanitizeDecimalInput(v))}
                keyboardType="decimal-pad"
                placeholder="e.g. 120.5"
                style={editStyles.input}
              />
            </View>

            <View className="gap-2">
              <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Pump start
              </Text>
              <AmPmTimePickerField
                label=""
                value={pumpStart}
                onChange={setPumpStart}
                placeholder="Tap to select start time"
              />
            </View>

            <View className="gap-2">
              <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Pump end
              </Text>
              <AmPmTimePickerField
                label=""
                value={pumpEnd}
                onChange={setPumpEnd}
                placeholder="Tap to select end time"
              />
            </View>

            <View className="gap-2">
              <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Meter image
              </Text>
              <Text className="text-sm text-muted-foreground">
                Upload a new photo to update, or keep the existing one.
              </Text>
              <View className="flex-row gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onPress={openCamera}
                >
                  <Text>Camera</Text>
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1"
                  onPress={openGallery}
                >
                  <Text>Gallery</Text>
                </Button>
              </View>
              <Text className="text-xs text-muted-foreground">
                {asset?.fileName || asset?.uri
                  ? `New: ${asset?.fileName ?? 'image'}`
                  : existingImageUrl
                  ? 'Using existing meter image on server.'
                  : 'No image selected'}
              </Text>
            </View>

            <Button
              className="w-full"
              onPress={onEditResubmit}
              disabled={saving}
            >
              <Text>{saving ? 'Submitting…' : 'Resubmit'}</Text>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Review & approval</CardTitle>
          <CardDescription>
            Remarks and who acted on this submission.
          </CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="gap-4 pt-4">
          <DetailRow label="Remarks" value={fmt(sub.remarks)} />
          <DetailRow label="Submitted at" value={fmtDate(sub.submitted_at)} />
          <DetailRow label="Reviewed at" value={fmtDate(sub.reviewed_at)} />
          <DetailRow label="Reviewed by" value={fmt(sub.reviewed_by_name)} />
          <DetailRow label="Approved at" value={fmtDate(sub.approved_at)} />
          <DetailRow label="Approved by" value={fmt(sub.approved_by_name)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Reporting period & location
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="gap-4 pt-4">
          <DetailRow label="Year" value={fmt(record.year)} />
          <DetailRow label="Month" value={fmt(record.month)} />
          <DetailRow label="Village" value={fmt(system.village)} />
          <DetailRow label="Tehsil" value={fmt(system.tehsil)} />
          <DetailRow label="Settlement" value={fmt(system.settlement)} />
          <DetailRow
            label="Facility UID"
            value={fmt(system.unique_identifier)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Water readings</CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="gap-4 pt-4">
          <>
            <DetailRow
              label="Total water pumped (m³)"
              value={fmt(record.total_water_pumped)}
            />
            <EvidenceImageBlock
              label="Meter / evidence"
              url={record.bulk_meter_image_url}
            />
          </>
        </CardContent>
      </Card>

      {audit.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activity log</CardTitle>
            <CardDescription>
              Verification steps and comments in order.
            </CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="gap-4 pt-4">
            {audit.map((entry, i) => (
              <View
                key={i}
                className="gap-1 border-b border-border/60 pb-3 last:border-0"
              >
                <View className="flex-row flex-wrap justify-between gap-1">
                  <Text className="text-sm font-semibold text-foreground">
                    {fmt(entry.action_type)}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {fmtDate(entry.timestamp)}
                  </Text>
                </View>
                <Text className="text-xs text-muted-foreground">
                  {fmt(entry.performed_by)} · {fmt(entry.role)}
                </Text>
                {entry.comment ? (
                  <Text className="text-sm text-foreground">
                    {fmt(entry.comment)}
                  </Text>
                ) : null}
              </View>
            ))}
          </CardContent>
        </Card>
      )}
    </ScrollView>
  );
}
