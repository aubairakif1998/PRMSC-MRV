import React from 'react';
import { View } from 'react-native';

import { Skeleton } from '../components/ui/skeleton';

/** Pick facility: intro + list rows */
export function PickFacilityLoading() {
  return (
    <View className="gap-3">
      <Skeleton className="h-4 w-full max-w-[90%] rounded-md" />
      <Skeleton className="h-4 w-full max-w-[70%] rounded-md" />
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-[76px] w-full rounded-xl" />
      ))}
    </View>
  );
}

/** My submissions: intro + tabs + cards */
export function MySubmissionsLoading() {
  return (
    <View className="gap-4">
      <View className="gap-2">
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-4 w-full max-w-[85%] rounded-md" />
      </View>
      <View className="flex-row flex-wrap gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-9 min-w-[72px] flex-1 rounded-lg" />
        ))}
      </View>
      <View className="gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-36 w-full rounded-xl" />
        ))}
      </View>
    </View>
  );
}

/** Submission detail full page */
export function SubmissionDetailLoading() {
  return (
    <View className="flex-1 bg-muted/30 p-4">
      <Skeleton className="mb-3 h-28 w-full rounded-xl" />
      <Skeleton className="mb-3 h-40 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </View>
  );
}

/** Drafts list */
export function DraftsListLoading() {
  return (
    <View className="flex-1 bg-muted/30 p-4">
      <View className="gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </View>
    </View>
  );
}

/** Monthly log form while resolving facility from `systemId` (parent supplies padding). */
export function MonthlyLogFormLoading({ variant }: { variant: 'water' | 'solar' }) {
  return (
    <View
      accessibilityLabel={`Loading ${variant === 'water' ? 'water' : 'solar'} log form`}
    >
      <Skeleton className="mb-4 h-8 w-[220px] max-w-full rounded-md" />
      <Skeleton className="mb-3 h-10 w-full rounded-lg" />
      <Skeleton className="mb-4 h-11 w-full rounded-lg" />
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="mb-3 h-12 w-full rounded-lg" />
      ))}
      <Skeleton className="mb-3 h-24 w-full rounded-lg" />
      <View className="mt-4 flex-row gap-2">
        <Skeleton className="h-12 flex-1 rounded-lg" />
        <Skeleton className="h-12 flex-1 rounded-lg" />
      </View>
    </View>
  );
}
