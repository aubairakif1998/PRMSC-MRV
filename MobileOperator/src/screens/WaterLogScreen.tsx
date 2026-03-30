import React, { useEffect, useLayoutEffect } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { LogEntryForm } from '../components/LogEntryForm';
import { drainQueue } from '../offline/queue';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'WaterLog'>;

export function WaterLogScreen({ route, navigation }: Props) {
  const p = route.params;
  const systemId = p?.systemId;
  const draftId = p?.draftId;
  const facilityLabel = p?.facilityLabel;

  useEffect(() => {
    drainQueue();
  }, []);

  useLayoutEffect(() => {
    if (facilityLabel) {
      navigation.setOptions({
        title: `Water monthly log · ${facilityLabel}`,
      });
    } else {
      navigation.setOptions({ title: 'Water monthly log' });
    }
  }, [navigation, facilityLabel]);

  return (
    <LogEntryForm
      key={`water-${systemId ?? ''}-${draftId ?? 'new'}`}
      type="water"
      draftId={draftId}
      systemId={systemId}
    />
  );
}
