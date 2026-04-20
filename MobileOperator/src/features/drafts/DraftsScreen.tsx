import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Image, RefreshControl, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { DraftsListLoading } from '../shared/screenSkeletons';
import { Text } from '../../components/ui/text';
import {
  deleteWaterDraftById,
  getWaterDrafts,
  type WaterDraftSummary,
} from '../../api/operator';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Drafts'>;

type DraftItem = WaterDraftSummary & { section: 'water' };

const LIST_CONTENT_STYLE = { paddingBottom: 30, gap: 10 } as const;
const THUMB_STYLE = { width: 52, height: 52 } as const;
const THUMB_IMAGE_STYLE = { ...THUMB_STYLE, borderRadius: 14 } as const;
const THUMB_PLACEHOLDER_STYLE = {
  ...THUMB_STYLE,
  borderRadius: 14,
  borderWidth: 1,
} as const;
const THUMB_PLACEHOLDER_BORDER = { borderColor: 'rgba(148, 163, 184, 0.45)' } as const;
function normalizeRemoteImageUrl(url: string): string {
  const u = url.trim();
  if (u.startsWith('http://')) return `https://${u.slice('http://'.length)}`;
  return u;
}

export function DraftsScreen({ navigation }: Props) {
  const prettyMeta = useMemo(() => {
    return (item: DraftItem) => {
      const parts: string[] = [];
      if (item.tehsil) parts.push(String(item.tehsil));
      if (item.village) parts.push(String(item.village));
      const dateBits =
        item.year && item.month
          ? `${String(item.month).padStart(2, '0')}/${item.year}${
              item.day ? `/${String(item.day).padStart(2, '0')}` : ''
            }`
          : '';
      return { location: parts.filter(Boolean).join(' · '), period: dateBits };
    };
  }, []);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [drafts, setDrafts] = useState<DraftItem[]>([]);

  const load = useCallback(async () => {
    try {
      const water = await getWaterDrafts();
      const merged: DraftItem[] = water
        .map(d => ({ ...d, section: 'water' as const }))
        .sort((a, b) => {
          const aa = a.created_at ?? '';
          const bb = b.created_at ?? '';
          return aa < bb ? 1 : -1;
        });
      setDrafts(merged);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onDelete = (item: DraftItem) => {
    Alert.alert('Delete draft', 'Are you sure you want to delete this draft?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteWaterDraftById(item.id)
            .then(load)
            .catch(() => {});
        },
      },
    ]);
  };

  if (loading) {
    return <DraftsListLoading />;
  }

  return (
    <View className="flex-1 bg-muted/30 p-4">
      <FlatList
        data={drafts}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        contentContainerStyle={LIST_CONTENT_STYLE}
        ListEmptyComponent={
          <Text className="text-muted-foreground mt-10 px-4 text-center">
            No drafts yet. From Water log, tap Save Draft anytime (saved to the server
            so it’s available across devices).
          </Text>
        }
        renderItem={({ item }) => {
          const meta = prettyMeta(item);
          const createdLabel = item.created_at
            ? new Date(item.created_at).toLocaleString()
            : '';
          return (
          <Card className="overflow-hidden border-border/70 bg-background py-3">
            <CardHeader className="pb-2">
              <View className="flex-row items-start justify-between gap-3">
                <View className="min-w-0 flex-1 flex-row items-center gap-3">
                  {item.bulk_meter_image_url ? (
                    <Image
                      source={{ uri: normalizeRemoteImageUrl(item.bulk_meter_image_url) }}
                      style={THUMB_IMAGE_STYLE}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      className="items-center justify-center bg-muted/50"
                      style={[THUMB_PLACEHOLDER_STYLE, THUMB_PLACEHOLDER_BORDER]}
                    >
                      <Text className="text-[10px] font-semibold text-muted-foreground">
                        Meter
                        {'\n'}photo
                      </Text>
                    </View>
                  )}
                  <View className="min-w-0 flex-1">
                    <CardTitle className="text-[15px] font-extrabold">
                      Water Draft
                    </CardTitle>
                    {meta.location ? (
                      <Text
                        className="text-muted-foreground mt-1 text-xs"
                        numberOfLines={2}
                      >
                        {meta.location}
                      </Text>
                    ) : null}
                    <Text className="text-muted-foreground mt-1 text-[11px]">
                      {createdLabel}
                      {meta.period ? ` · ${meta.period}` : ''}
                    </Text>
                  </View>
                </View>
                <Badge variant="outline" className="mt-1">
                  Water
                </Badge>
              </View>
            </CardHeader>
            <CardContent className="flex-row gap-2 pt-1">
              <Button
                variant="secondary"
                className="flex-1"
                onPress={() =>
                  navigation.navigate('WaterLog', {
                    draftId: item.id,
                    systemId: item.system_id,
                  })
                }
              >
                Edit Draft
              </Button>
              <Button
                variant="destructive"
                className="min-w-[104px]"
                onPress={() => onDelete(item)}
              >
                Delete
              </Button>
            </CardContent>
          </Card>
          );
        }}
      />
    </View>
  );
}
