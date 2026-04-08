import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  FlatList,
  KeyboardAvoidingView,
  ListRenderItem,
  Platform,
  RefreshControl,
  View,
} from 'react-native';
import {
  AlertCircle,
  Calendar,
  Clock,
  Droplets,
  Inbox,
  MapPin,
} from 'lucide-react-native';

import { getMySubmissions } from '../../api/operator';
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
import { MySubmissionsLoading } from '../shared/screenSkeletons';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Text } from '../../components/ui/text';
import type { RootStackParamList } from '../../navigation/types';
import { getQueue } from '../../offline/queue';
import type { QueueItem } from '../../types/operator';

const STATUS = ['all', 'submitted', 'verified', 'rejected'] as const;

type Submission = Record<string, unknown>;

function formatLocation(submission: Submission): string {
  const info = (submission.system_info || {}) as Record<string, unknown>;
  const village = typeof info.village === 'string' ? info.village : '';
  const tehsil = typeof info.tehsil === 'string' ? info.tehsil : '';
  if (village && tehsil) return `${village}, ${tehsil}`;
  return village || tehsil || '—';
}

function formatSubmissionType(raw: unknown): string {
  const s = String(raw ?? '—');
  if (s === '—') return s;
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatWhen(raw: unknown): string {
  const s = raw != null ? String(raw) : '';
  if (!s || s === '—') return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/** API uses `submitted_at`; older clients may use other keys. */
function getSubmittedAt(item: Submission): unknown {
  return item.submitted_at ?? item.submission_date ?? item.created_at ?? null;
}

function filterLabel(s: (typeof STATUS)[number]): string {
  if (s === 'all') return 'All';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getStatusVariant(status: string) {
  const s = status.toLowerCase();
  if (s === 'verified') return 'secondary' as const;
  if (s === 'rejected') return 'destructive' as const;
  if (s === 'submitted') return 'default' as const;
  return 'outline' as const;
}

function submissionKind(type: unknown): 'water' | 'other' {
  const t = String(type ?? '').toLowerCase();
  if (t.includes('water')) return 'water';
  return 'other';
}

const LIST_CONTENT_STYLE = { paddingBottom: 32, gap: 0 } as const;

export function MySubmissionsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [status, setStatus] = useState<(typeof STATUS)[number]>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Submission[]>([]);
  const [queuedItems, setQueuedItems] = useState<QueueItem[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await getMySubmissions(status === 'all' ? undefined : status);
      const submissions = res.submissions || [];
      // MobileOperator is water-only.
      const waterOnly = submissions.filter(s =>
        String((s as Record<string, unknown>).submission_type ?? '')
          .toLowerCase()
          .includes('water'),
      );
      setItems(waterOnly);
      const queue = await getQueue();
      setQueuedItems(queue);
    } catch (e: unknown) {
      const message = getApiErrorMessage(e, 'Failed to load submissions.');
      setError(message);
      setItems([]);
      const queue = await getQueue();
      setQueuedItems(queue);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const statusLine = useMemo(
    () => `Filtered by: ${filterLabel(status)}`,
    [status],
  );

  const renderItem: ListRenderItem<Submission> = useCallback(
    ({ item }) => {
      const rowStatus = String(item.status ?? '—');
      const kind = submissionKind(item.submission_type);
      const TypeIcon = kind === 'water' ? Droplets : Inbox;
      const iconColor = kind === 'water' ? '#0369a1' : '#64748b';
      const sid = String(item.id ?? '');

      return (
        <Card className="mb-3 overflow-hidden border-border/80 py-0 shadow-sm shadow-black/5">
          <CardHeader className="gap-1 pb-2 pt-4">
            <View className="flex-row items-start justify-between gap-2">
              <View className="min-w-0 flex-1 flex-row items-center gap-2">
                <View className="rounded-lg bg-muted p-2">
                  <TypeIcon size={18} color={iconColor} strokeWidth={2} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Submission
                  </Text>
                  <CardTitle className="text-base leading-tight">
                    {formatSubmissionType(item.submission_type)}
                  </CardTitle>
                </View>
              </View>
              <Badge variant={getStatusVariant(rowStatus)} className="shrink-0">
                {rowStatus}
              </Badge>
            </View>
            <Text className="font-mono text-xs text-muted-foreground">
              ID {String(item.id ?? '—')}
            </Text>
          </CardHeader>
          <Separator />
          <CardContent className="gap-3 pt-3">
            <View className="flex-row items-start gap-2">
              <View className="mt-0.5">
                <MapPin size={16} color="#64748b" strokeWidth={2} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-xs font-medium text-muted-foreground">
                  Location
                </Text>
                <Text className="text-sm font-medium text-foreground">
                  {formatLocation(item)}
                </Text>
              </View>
            </View>
            <View className="flex-row items-start gap-2">
              <View className="mt-0.5">
                <Calendar size={16} color="#64748b" strokeWidth={2} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-xs font-medium text-muted-foreground">
                  Submitted
                </Text>
                <Text className="text-sm text-foreground">
                  {formatWhen(getSubmittedAt(item))}
                </Text>
              </View>
            </View>
            {typeof item.remarks === 'string' && item.remarks.trim() ? (
              <View className="rounded-md bg-muted/60 px-2 py-1.5">
                <Text className="text-xs font-medium text-muted-foreground">
                  Remarks
                </Text>
                <Text className="text-sm text-foreground" numberOfLines={3}>
                  {item.remarks}
                </Text>
              </View>
            ) : null}
            <Separator />
            <Button
              variant="secondary"
              className="w-full"
              onPress={() =>
                navigation.navigate('SubmissionDetail', {
                  submissionId: sid,
                })
              }
            >
              <Text>View full details</Text>
            </Button>
          </CardContent>
        </Card>
      );
    },
    [navigation],
  );

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-muted/30"
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <View className="flex-1 px-4 pt-4">
        {loading ? (
          <MySubmissionsLoading />
        ) : (
          <>
            <Text className="mb-3 text-sm leading-5 text-muted-foreground">
              Verification status for data you have sent to the server.
            </Text>
            <Tabs
              value={status}
              onValueChange={v => setStatus(v as (typeof STATUS)[number])}
            >
              <TabsList className="mb-4 h-auto w-full flex-row flex-wrap justify-start gap-1 p-1">
                {STATUS.map(s => (
                  <TabsTrigger
                    key={s}
                    value={s}
                    className="min-h-9 flex-1 px-2 sm:flex-none"
                  >
                    <Text className="text-xs font-semibold capitalize">
                      {filterLabel(s)}
                    </Text>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <FlatList
              data={items}
              keyExtractor={(item, idx) => String(item.id ?? idx)}
              contentContainerStyle={LIST_CONTENT_STYLE}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              ListHeaderComponent={
                <View className="mb-4 gap-3">
                  {!!queuedItems.length && (
                    <Alert
                      icon={Clock}
                      className="border-amber-200/90 bg-amber-50 dark:bg-amber-950/30"
                      iconClassName="text-amber-700"
                    >
                      <AlertTitle className="text-amber-950 dark:text-amber-100">
                        Queued for sync
                      </AlertTitle>
                      <AlertDescription className="text-amber-900/90 dark:text-amber-200/90">
                        {queuedItems.length} offline{' '}
                        {queuedItems.length === 1 ? 'entry' : 'entries'}. They
                        upload when you are online.
                      </AlertDescription>
                      <View className="mt-3 gap-2 border-t border-amber-200/60 pt-3">
                        {queuedItems.slice(0, 4).map(q => (
                          <View
                            key={q.id}
                            className="flex-row items-center justify-between"
                          >
                            <Text className="text-sm font-medium text-amber-950 dark:text-amber-100">
                              Water log
                            </Text>
                            <Text className="text-xs text-amber-800 dark:text-amber-300">
                              {new Date(q.createdAt).toLocaleString()}
                            </Text>
                          </View>
                        ))}
                        {queuedItems.length > 4 && (
                          <Text className="text-xs font-medium text-amber-900 dark:text-amber-200">
                            +{queuedItems.length - 4} more in queue
                          </Text>
                        )}
                      </View>
                    </Alert>
                  )}

                  {error ? (
                    <Alert icon={AlertCircle} variant="destructive">
                      <AlertTitle>Could not load list</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                      <View className="mt-3 pl-6">
                        <Button
                          variant="outline"
                          size="sm"
                          onPress={() => {
                            setLoading(true);
                            load();
                          }}
                        >
                          <Text>Try again</Text>
                        </Button>
                      </View>
                    </Alert>
                  ) : (
                    <Text className="text-xs font-medium text-muted-foreground">
                      {statusLine}
                    </Text>
                  )}
                </View>
              }
              renderItem={renderItem}
              ListEmptyComponent={
                !error ? (
                  <Card className="border-dashed bg-muted/40 py-10">
                    <CardContent className="items-center gap-2">
                      <View className="rounded-full bg-muted p-3">
                        <Inbox size={28} color="#64748b" strokeWidth={1.75} />
                      </View>
                      <CardTitle className="text-center text-base">
                        No submissions
                      </CardTitle>
                      <CardDescription className="text-center">
                        Nothing matches this filter yet, or you have not
                        submitted from this account.
                      </CardDescription>
                    </CardContent>
                  </Card>
                ) : null
              }
            />
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
