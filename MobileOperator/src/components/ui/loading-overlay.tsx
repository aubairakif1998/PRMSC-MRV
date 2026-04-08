import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { ActivityIndicator, Platform, View, type ViewProps } from 'react-native';
import { FullWindowOverlay as RNFullWindowOverlay } from 'react-native-screens';

const FullWindowOverlay = Platform.OS === 'ios' ? RNFullWindowOverlay : React.Fragment;

type LoadingOverlayProps = ViewProps & {
  visible: boolean;
  title?: string;
  message?: string;
};

export function LoadingOverlay({
  visible,
  title = 'Submitting…',
  message = 'Please wait. Do not close the app.',
  className,
  ...props
}: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <FullWindowOverlay>
      <View
        className={cn(
          'absolute bottom-0 left-0 right-0 top-0 z-50 items-center justify-center bg-black/40 px-6',
          className
        )}
        pointerEvents="auto"
        {...props}
      >
        <View className="bg-background border-border w-full max-w-[420px] items-center gap-3 rounded-2xl border px-6 py-5 shadow-lg shadow-black/10">
          <ActivityIndicator size="large" />
          <Text variant="large" className="text-center">
            {title}
          </Text>
          <Text variant="muted" className="text-center">
            {message}
          </Text>
        </View>
      </View>
    </FullWindowOverlay>
  );
}

