import React, { useCallback, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getSolarSystems, getWaterSystems } from '../api/operator';
import { getApiErrorMessage } from '../lib/api-error';
import type { RootStackParamList } from '../navigation/types';
import { Card, CardContent } from '../components/ui/card';
import { Text } from '../components/ui/text';
import { PickFacilityLoading } from './screenSkeletons';

type FacilityRow = {
  id: string;
  tehsil: string;
  village: string;
  settlement: string;
  label?: string;
};

function normalizeRow(raw: Record<string, unknown>): FacilityRow | null {
  const id = raw.id != null ? String(raw.id) : '';
  const tehsil = typeof raw.tehsil === 'string' ? raw.tehsil : '';
  const village = typeof raw.village === 'string' ? raw.village : '';
  const settlementRaw = raw.settlement;
  const settlement =
    typeof settlementRaw === 'string' ? settlementRaw : settlementRaw == null ? '' : String(settlementRaw);
  if (!id || !tehsil || !village) return null;
  const uid = typeof raw.unique_identifier === 'string' ? raw.unique_identifier : undefined;
  return {
    id,
    tehsil,
    village,
    settlement,
    label: uid,
  };
}

type Props = NativeStackScreenProps<RootStackParamList, 'PickFacility'>;

export function PickFacilityScreen({ navigation, route }: Props) {
  const { kind } = route.params;
  const [items, setItems] = useState<FacilityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const raw =
        kind === 'water'
          ? ((await getWaterSystems()) as unknown[])
          : ((await getSolarSystems()) as unknown[]);
      const next: FacilityRow[] = [];
      for (const row of raw) {
        if (row && typeof row === 'object') {
          const n = normalizeRow(row as Record<string, unknown>);
          if (n) next.push(n);
        }
      }
      setItems(next);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, 'Could not load your facilities.'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-muted/30"
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
    <View className="flex-1 p-4">
      {loading ? (
        <PickFacilityLoading />
      ) : (
        <>
      <Text className="text-muted-foreground mb-3 text-sm">
        Tap a facility you already registered. The monthly log will open with this location filled in.
      </Text>

      {error ? (
        <Card className="border-destructive/40">
          <CardContent className="py-4">
            <Text className="text-destructive text-sm">{error}</Text>
            <Pressable onPress={load} className="mt-3">
              <Text className="text-primary font-semibold">Try again</Text>
            </Pressable>
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-6">
            <Text className="text-foreground text-center font-medium">
              No {kind === 'water' ? 'water' : 'solar'} facilities yet.
            </Text>
            <Text className="text-muted-foreground mt-2 text-center text-sm">
              Register a facility first, then you can return here for quick logging.
            </Text>
          </CardContent>
        </Card>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={items}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerClassName="gap-2 pb-8"
          renderItem={({ item }) => {
            const facilityLabel = [item.tehsil, item.village, item.settlement]
              .filter(Boolean)
              .join(' · ');
            const goToLog = () => {
              // Use `push` (not `replace`): native stack + `getId` can fail to navigate with `replace` on iOS.
              if (kind === 'water') {
                navigation.push('WaterLog', {
                  systemId: item.id,
                  facilityLabel,
                });
              } else {
                navigation.push('SolarLog', {
                  systemId: item.id,
                  facilityLabel,
                });
              }
            };
            return (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={goToLog}
                accessibilityRole="button"
                accessibilityLabel={`Open monthly log for ${facilityLabel}`}
              >
                <Card className="py-0">
                  <CardContent className="py-3">
                    <Text className="font-semibold text-foreground">
                      {item.tehsil} · {item.village}
                      {item.settlement ? ` · ${item.settlement}` : ''}
                    </Text>
                    {item.label ? (
                      <Text className="text-muted-foreground mt-1 text-xs">{item.label}</Text>
                    ) : null}
                  </CardContent>
                </Card>
              </TouchableOpacity>
            );
          }}
        />
      )}
        </>
      )}
    </View>
    </KeyboardAvoidingView>
  );
}
