import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import NetInfo from '@react-native-community/netinfo';
import {
  ClipboardList,
  Droplets,
  FileText,
  Inbox,
  Sun,
  Zap,
} from 'lucide-react-native';

import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../auth/AuthContext';
import { drainQueue, getQueue } from '../offline/queue';
import type { QueueItem } from '../types/operator';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Separator } from '../components/ui/separator';
import { Text } from '../components/ui/text';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

function HomeSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-4 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm shadow-black/[0.06]">
      <View className="border-b border-border/60 bg-muted/50 px-3 py-2.5">
        <Text className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          {title}
        </Text>
        {hint ? (
          <Text className="mt-1 text-[11px] leading-4 text-muted-foreground">{hint}</Text>
        ) : null}
      </View>
      <View className="p-3">{children}</View>
    </View>
  );
}

function HomeTile({
  icon,
  title,
  subtitle,
  onPress,
  accessibilityLabel,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="min-h-[104px] flex-1 rounded-xl border border-border/70 bg-background p-3 active:bg-muted/80"
      style={({ pressed }) => [pressed && styles.tilePressed]}
    >
      <View className="mb-2 items-center justify-center self-center rounded-2xl border border-border/40 bg-muted/60 p-3">
        {icon}
      </View>
      <Text
        className="text-center text-[13px] font-bold leading-snug text-foreground"
        numberOfLines={3}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          className="mt-1 text-center text-[11px] leading-4 text-muted-foreground"
          numberOfLines={2}
        >
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function HomeScreen({ navigation }: Props) {
  const { user, logout } = useAuth();
  const [queuedCount, setQueuedCount] = React.useState(0);
  const [queuedItems, setQueuedItems] = React.useState<QueueItem[]>([]);
  const [syncMessage, setSyncMessage] = React.useState('');

  const refreshQueueCount = React.useCallback(async () => {
    const items = await getQueue();
    setQueuedCount(items.length);
    setQueuedItems(items.slice(0, 3));
  }, []);

  const runQueueSync = React.useCallback(async () => {
    try {
      const result = await drainQueue();
      await refreshQueueCount();
      if (result.synced > 0) {
        setSyncMessage(
          `Synced ${result.synced} queued submission${
            result.synced > 1 ? 's' : ''
          }.`,
        );
      } else if (result.retained > 0) {
        setSyncMessage('Queue still pending. Will retry automatically.');
      } else if (result.dropped > 0) {
        setSyncMessage(
          `Dropped ${result.dropped} invalid queued submission${
            result.dropped > 1 ? 's' : ''
          }.`,
        );
      } else {
        setSyncMessage('');
      }
    } catch {
      setSyncMessage('Sync check failed. Queue is kept safely for retry.');
    }
  }, [refreshQueueCount]);

  useEffect(() => {
    runQueueSync().catch(() => {});
    const unsub = NetInfo.addEventListener(state => {
      const online = Boolean(
        state.isConnected && state.isInternetReachable !== false,
      );
      if (online) {
        runQueueSync().catch(() => {});
      } else {
        refreshQueueCount().catch(() => {});
      }
    });
    return () => unsub();
  }, [refreshQueueCount, runQueueSync]);

  useFocusEffect(
    React.useCallback(() => {
      runQueueSync().catch(() => {});
      return () => {};
    }, [runQueueSync]),
  );

  return (
    <View className="flex-1 bg-muted/30">
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4 pb-8"
        showsVerticalScrollIndicator={false}
      >
        <Text className="mb-4 text-2xl font-extrabold tracking-tight text-foreground">
          Welcome{user?.name ? `, ${user.name}` : ''}
        </Text>
        <Text className="mb-4 mt-1 text-sm leading-5 text-muted-foreground">
          Tap an icon below. Offline entries sync when you are online.
        </Text>

        {!!syncMessage && (
          <Card className="mb-3 border-primary/30 bg-primary/5 py-2">
            <CardContent className="py-2">
              <Text className="text-xs font-medium text-primary">{syncMessage}</Text>
            </CardContent>
          </Card>
        )}

        <HomeSection
          title="New facility"
          hint="First-time registration for a water or solar site."
        >
          <View className="flex-row gap-2">
            <HomeTile
              icon={<Droplets color="#0369a1" size={26} strokeWidth={2} />}
              title="Register water facility"
              accessibilityLabel="Register water facility"
              onPress={() => navigation.navigate('WaterSystemRegister')}
            />
            <HomeTile
              icon={<Sun color="#c2410c" size={26} strokeWidth={2} />}
              title="Register solar site"
              accessibilityLabel="Register solar site"
              onPress={() => navigation.navigate('SolarSystemRegister')}
            />
          </View>
        </HomeSection>

        <HomeSection
          title="Monthly log"
          hint="Full form: month, location, readings, and photo evidence."
        >
          <View className="flex-row gap-2">
            <HomeTile
              icon={<ClipboardList color="#0284c7" size={26} strokeWidth={2} />}
              title="Monthly water log"
              accessibilityLabel="Monthly water log"
              onPress={() => navigation.navigate('WaterLog')}
            />
            <HomeTile
              icon={<ClipboardList color="#d97706" size={26} strokeWidth={2} />}
              title="Monthly solar log"
              accessibilityLabel="Monthly solar log"
              onPress={() => navigation.navigate('SolarLog')}
            />
          </View>
        </HomeSection>

        <HomeSection
          title="Quick log"
          hint="Pick a saved facility — location fields fill in."
        >
          <View className="flex-row gap-2">
            <HomeTile
              icon={<Zap color="#0e7490" size={24} strokeWidth={2} />}
              title="Quick log (water)"
              subtitle="Saved facility"
              accessibilityLabel="Quick log water, saved facility"
              onPress={() => navigation.navigate('PickFacility', { kind: 'water' })}
            />
            <HomeTile
              icon={<Zap color="#ca8a04" size={24} strokeWidth={2} />}
              title="Quick log (solar)"
              subtitle="Saved facility"
              accessibilityLabel="Quick log solar, saved facility"
              onPress={() => navigation.navigate('PickFacility', { kind: 'solar' })}
            />
          </View>
        </HomeSection>

        <HomeSection title="Records" hint="Server status and local drafts on this device.">
          <View className="flex-row gap-2">
            <HomeTile
              icon={<Inbox color="#6d28d9" size={26} strokeWidth={2} />}
              title="My submissions"
              subtitle="Verification status"
              accessibilityLabel="My submissions"
              onPress={() => navigation.navigate('MySubmissions')}
            />
            <HomeTile
              icon={<FileText color="#475569" size={26} strokeWidth={2} />}
              title="Saved drafts"
              subtitle="On this device"
              accessibilityLabel="Saved drafts on this device"
              onPress={() => navigation.navigate('Drafts')}
            />
          </View>
        </HomeSection>

        {!!queuedCount && (
          <Card className="mb-3 border-amber-300/90 bg-amber-50 py-2">
            <CardContent className="py-2">
              <Text className="text-xs font-semibold text-amber-900">
                {queuedCount} queued — syncs when online.
              </Text>
            </CardContent>
          </Card>
        )}

        {!!queuedItems.length && (
          <Card className="mb-2 overflow-hidden rounded-2xl border border-border/70 py-0">
            <CardHeader className="border-b border-border/50 bg-muted/40 py-2">
              <CardTitle className="text-sm font-bold">Sync queue</CardTitle>
            </CardHeader>
            <CardContent className="gap-0 pt-0">
              {queuedItems.map((item, idx) => (
                <View key={item.id}>
                  {idx > 0 ? <Separator /> : null}
                  <View className="flex-row items-center justify-between py-2.5">
                    <Text className="font-semibold text-foreground">
                      {item.type === 'water' ? 'Water log' : 'Solar log'}
                    </Text>
                    <Text className="text-muted-foreground text-xs">
                      {new Date(item.createdAt).toLocaleString()}
                    </Text>
                  </View>
                </View>
              ))}
              {queuedCount > queuedItems.length ? (
                <Text className="text-muted-foreground pb-2 text-xs font-medium">
                  +{queuedCount - queuedItems.length} more
                </Text>
              ) : null}
            </CardContent>
          </Card>
        )}

        <Button
          variant="ghost"
          className="mt-3"
          onPress={() => {
            logout().catch(() => {});
          }}
        >
          Logout
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tilePressed: {
    opacity: 0.88,
  },
});
