/**
 * Monthly water log for assigned systems. Submission body matches
 * `POST /api/operator/water-supply-data` (`data`, `year`, `status`, optional `image_url`).
 * Field-level requirements are documented in `LogEntryForm`.
 */
import React, { useEffect, useLayoutEffect } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { LogEntryForm } from '../../components/LogEntryForm';
import { drainQueue } from '../../offline/queue';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'WaterLog'>;

export function WaterLogScreen({ route, navigation }: Props) {
  const p = route.params;
  const systemId = p?.systemId;
  const draftId = p?.draftId;
  const facilityLabel = p?.facilityLabel;

  useEffect(() => {
    drainQueue();
  }, []);

  useEffect(() => {
    // Enforce "assigned water systems only": if opened without a system (and not editing a draft),
    // redirect to the facility picker.
    if (!systemId && !draftId) {
      navigation.navigate('Assignments');
    }
  }, [navigation, systemId, draftId]);

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
