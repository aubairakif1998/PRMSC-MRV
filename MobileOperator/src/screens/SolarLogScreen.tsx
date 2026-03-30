import React, { useEffect, useLayoutEffect } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { LogEntryForm } from '../components/LogEntryForm';
import { drainQueue } from '../offline/queue';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SolarLog'>;

export function SolarLogScreen({ route, navigation }: Props) {
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
        title: `Solar monthly log · ${facilityLabel}`,
      });
    } else {
      navigation.setOptions({ title: 'Solar monthly log' });
    }
  }, [navigation, facilityLabel]);

  return (
    <LogEntryForm
      key={`solar-${systemId ?? ''}-${draftId ?? 'new'}`}
      type="solar"
      draftId={draftId}
      systemId={systemId}
    />
  );
}
