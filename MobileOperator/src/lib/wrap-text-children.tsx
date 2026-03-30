import * as React from 'react';
import type { PressableStateCallbackType } from 'react-native';

import { Text } from '@/components/ui/text';

/**
 * React Native requires strings inside `<Text>`. `React.Children.toArray` flattens
 * fragments and arrays so `<>icon + "label"</>` and stray whitespace nodes become
 * individual children we can wrap (Android throws otherwise).
 */
export function wrapTextChildren(children: React.ReactNode): React.ReactNode {
  return React.Children.toArray(children).map((child, index) => {
    if (typeof child === 'string' || typeof child === 'number') {
      return (
        <Text key={index}>{child}</Text>
      );
    }
    return child;
  });
}

export type WrappablePressableChild =
  | React.ReactNode
  | ((state: PressableStateCallbackType) => React.ReactNode);

/** Like wrapTextChildren but leaves Pressable-style render functions untouched. */
export function wrapMaybePressableChild(
  children: WrappablePressableChild
): WrappablePressableChild {
  if (typeof children === 'function') {
    return children;
  }
  return wrapTextChildren(children);
}
