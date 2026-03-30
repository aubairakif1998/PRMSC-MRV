import { cn } from '@/lib/utils';
import { wrapTextChildren } from '@/lib/wrap-text-children';
import { View } from 'react-native';

function Skeleton({
  className,
  children,
  ...props
}: React.ComponentProps<typeof View> & React.RefAttributes<View>) {
  return (
    <View
      className={cn(
        'rounded-md border border-border/40 bg-slate-300 dark:border-border/60 dark:bg-slate-600',
        'animate-pulse',
        className,
      )}
      {...props}
    >
      {wrapTextChildren(children)}
    </View>
  );
}

export { Skeleton };
