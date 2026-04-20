import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  ClipboardList,
  FileText,
  Home,
  Inbox,
  LogOut,
  Menu,
  PenLine,
  X,
} from 'lucide-react-native';

import { useAuth } from '../auth/AuthContext';
import type { AuthUser } from '../types/auth';
import { navigationRef } from './navigationRef';

function initialsFromUser(user: AuthUser | null | undefined): string {
  const name = user?.name?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase();
    }
    if (parts.length === 1 && parts[0]!.length > 0) {
      return parts[0]!.slice(0, 2).toUpperCase();
    }
  }
  const email = user?.email?.trim();
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return 'OP';
}

type DrawerIcon = React.ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
}>;

const DRAWER_ACCENTS = {
  neutral: { fg: '#475569', bg: '#f1f5f9', border: '#e2e8f0' },
  water: { fg: '#0369a1', bg: '#e0f2fe', border: '#bae6fd' },
  danger: { fg: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
} as const;

function DrawerDivider() {
  return <View style={styles.drawerDivider} />;
}

function DrawerNavRow({
  icon: Icon,
  label,
  onPress,
  tone = 'default',
  accent = 'neutral',
}: {
  icon: DrawerIcon;
  label: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
  accent?: keyof typeof DRAWER_ACCENTS;
}) {
  const palette =
    tone === 'danger' ? DRAWER_ACCENTS.danger : DRAWER_ACCENTS[accent];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.drawerRowPressable,
        pressed && styles.drawerRowPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.drawerRowInner}>
        <View
          style={[
            styles.drawerIconCircle,
            {
              backgroundColor: palette.bg,
              borderColor: palette.border,
            },
          ]}
        >
          <Icon size={18} color={palette.fg} strokeWidth={2} />
        </View>
        <RNText
          style={[
            styles.drawerRowLabel,
            tone === 'danger' && styles.drawerRowLabelDanger,
          ]}
          numberOfLines={2}
        >
          {label}
        </RNText>
      </View>
    </Pressable>
  );
}

function DrawerSectionLabel({ children }: { children: string }) {
  return <RNText style={styles.drawerSectionLabel}>{children}</RNText>;
}

type AppDrawerContextValue = {
  openDrawer: () => void;
};

const AppDrawerContext = createContext<AppDrawerContextValue | null>(null);

export function useAppDrawer(): AppDrawerContextValue {
  const ctx = useContext(AppDrawerContext);
  if (!ctx) {
    throw new Error('useAppDrawer must be used within AppDrawerProvider');
  }
  return ctx;
}

export function AppDrawerProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const drawerTranslate = useRef(new Animated.Value(-340)).current;

  const openDrawer = useCallback(() => {
    setMenuOpen(true);
    Animated.timing(drawerTranslate, {
      toValue: 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [drawerTranslate]);

  const closeDrawer = useCallback(
    (afterClose?: () => void) => {
      Animated.timing(drawerTranslate, {
        toValue: -340,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setMenuOpen(false);
        afterClose?.();
      });
    },
    [drawerTranslate],
  );

  const ctx = useMemo(() => ({ openDrawer }), [openDrawer]);

  return (
    <AppDrawerContext.Provider value={ctx}>
      {children}
      <Modal
        transparent
        visible={menuOpen}
        animationType="none"
        onRequestClose={() => closeDrawer()}
      >
        <View style={styles.drawerOverlay}>
          <Animated.View
            style={[
              styles.drawerCard,
              { transform: [{ translateX: drawerTranslate }] },
            ]}
          >
            <View
              style={[
                styles.drawerHeader,
                { paddingTop: Math.max(insets.top, 12) + 8 },
              ]}
            >
              <View style={styles.drawerHeaderInner}>
                <View style={styles.drawerAvatarLarge} accessibilityRole="image">
                  <RNText style={styles.drawerAvatarLargeText}>
                    {initialsFromUser(user)}
                  </RNText>
                </View>
                <RNText style={styles.drawerBrand}>MRV Operator</RNText>
                <RNText style={styles.drawerUserEmail} numberOfLines={2}>
                  {user?.email || user?.name || 'Operator'}
                </RNText>
              </View>
            </View>

            <ScrollView
              style={styles.drawerScroll}
              contentContainerStyle={styles.drawerScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <DrawerNavRow
                icon={Home}
                label="Home"
                accent="neutral"
                onPress={() =>
                  closeDrawer(() => {
                    if (navigationRef.isReady()) {
                      navigationRef.resetRoot({
                        index: 0,
                        routes: [{ name: 'Home' as never }],
                      });
                    }
                  })
                }
              />

              <DrawerDivider />

              <DrawerSectionLabel>Monthly</DrawerSectionLabel>
              <DrawerNavRow
                icon={ClipboardList}
                label="My assignments"
                accent="water"
                onPress={() =>
                  closeDrawer(() => {
                    if (navigationRef.isReady())
                      navigationRef.navigate('Assignments');
                  })
                }
              />

              <DrawerDivider />

              <DrawerSectionLabel>Records</DrawerSectionLabel>
              <DrawerNavRow
                icon={Inbox}
                label="My submissions"
                accent="neutral"
                onPress={() =>
                  closeDrawer(() => {
                    if (navigationRef.isReady()) {
                      navigationRef.navigate('MySubmissions');
                    }
                  })
                }
              />
              <DrawerNavRow
                icon={FileText}
                label="Saved drafts"
                accent="neutral"
                onPress={() =>
                  closeDrawer(() => {
                    if (navigationRef.isReady())
                      navigationRef.navigate('Drafts');
                  })
                }
              />
              <DrawerNavRow
                icon={PenLine}
                label="Signature"
                accent="neutral"
                onPress={() =>
                  closeDrawer(() => {
                    if (navigationRef.isReady())
                      navigationRef.navigate('Signature');
                  })
                }
              />
            </ScrollView>

            <View
              style={[
                styles.drawerFooter,
                { paddingBottom: Math.max(insets.bottom, 14) },
              ]}
            >
              <DrawerNavRow
                icon={LogOut}
                label="Sign out"
                tone="danger"
                onPress={() =>
                  closeDrawer(() => {
                    logout().catch(() => {});
                  })
                }
              />
            </View>
          </Animated.View>
          <Pressable
            style={styles.drawerBackdropTapArea}
            onPress={() => closeDrawer()}
          />
        </View>
      </Modal>
    </AppDrawerContext.Provider>
  );
}

export function AppHeaderLeft() {
  const { openDrawer } = useAppDrawer();
  const navigation = useNavigation();
  const canGoBack = navigation.canGoBack();

  /** Root (e.g. Home): menu only. Nested screens: back only — avoids duplicate controls. */
  if (canGoBack) {
    return (
      <Pressable
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={{ top: 12, bottom: 12, left: 4, right: 8 }}
        style={styles.headerMenuBtn}
      >
        <ChevronLeft color="#0f172a" size={26} strokeWidth={2.25} />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={openDrawer}
      accessibilityRole="button"
      accessibilityLabel="Open menu"
      hitSlop={{ top: 12, bottom: 12, left: 4, right: 8 }}
      style={styles.headerMenuBtn}
    >
      <Menu color="#0f172a" size={22} strokeWidth={2.25} />
    </Pressable>
  );
}

/** Home only: centered app name (connectivity shown on avatar badge). */
export function AppHeaderTitle() {
  return (
    <View style={styles.appHeaderTitleWrap} pointerEvents="none">
      <RNText style={styles.appHeaderTitleText}>MRV Operator</RNText>
    </View>
  );
}

/** Initials avatar + corner connectivity badge (green dot online, grey cross offline). */
export function AppHeaderAvatar() {
  const { user } = useAuth();
  const [online, setOnline] = useState(true);
  useEffect(() => {
    NetInfo.fetch()
      .then(state => {
        setOnline(
          Boolean(state.isConnected && state.isInternetReachable !== false),
        );
      })
      .catch(() => {});
    const unsub = NetInfo.addEventListener(state => {
      setOnline(
        Boolean(state.isConnected && state.isInternetReachable !== false),
      );
    });
    return () => unsub();
  }, []);

  const label = user?.name?.trim() || user?.email?.trim() || 'Operator';
  const a11y = `Signed in as ${label}. ${online ? 'Online' : 'Offline'}.`;

  return (
    <View
      style={styles.headerAvatarOuter}
      accessibilityRole="image"
      accessibilityLabel={a11y}
    >
      <View style={styles.headerAvatarWrap}>
        <RNText style={styles.headerAvatarText}>{initialsFromUser(user)}</RNText>
      </View>
      <View
        style={[
          styles.headerAvatarBadge,
          online ? styles.headerAvatarBadgeOnline : styles.headerAvatarBadgeOffline,
        ]}
        pointerEvents="none"
      >
        {online ? null : (
          <X size={9} color="#475569" strokeWidth={2.5} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  appHeaderTitleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    maxWidth: 220,
  },
  appHeaderTitleText: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  headerAvatarOuter: {
    position: 'relative',
    marginRight: 8,
  },
  headerMenuBtn: {
    paddingLeft: 4,
    paddingVertical: 4,
  },
  headerAvatarWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0ea5e9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(14, 165, 233, 0.5)',
  },
  headerAvatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarBadgeOnline: {
    backgroundColor: '#22c55e',
  },
  headerAvatarBadgeOffline: {
    backgroundColor: '#e2e8f0',
  },
  headerAvatarText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  drawerHeaderInner: {
    alignItems: 'center',
    width: '100%',
  },
  drawerAvatarLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#38bdf8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'rgba(248, 250, 252, 0.25)',
  },
  drawerAvatarLargeText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  drawerOverlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  drawerCard: {
    width: '82%',
    maxWidth: 320,
    height: '100%',
    backgroundColor: '#ffffff',
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    borderRightWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 16,
    overflow: 'hidden',
  },
  drawerHeader: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.35)',
  },
  drawerBrand: {
    color: '#f8fafc',
    textAlign: 'center',
    alignSelf: 'stretch',
    marginBottom: 4,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  drawerUserEmail: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    alignSelf: 'stretch',
    marginTop: 4,
    lineHeight: 17,
  },
  drawerScroll: {
    flex: 1,
  },
  drawerScrollContent: {
    paddingHorizontal: 0,
    paddingTop: 8,
    paddingBottom: 16,
  },
  drawerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 16,
    marginVertical: 10,
  },
  drawerSectionLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 2,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  drawerRowPressable: {
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 3,
  },
  drawerRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    minHeight: 48,
    paddingVertical: 2,
  },
  drawerIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  drawerRowPressed: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
  },
  drawerRowLabel: {
    flex: 1,
    minWidth: 0,
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.15,
    lineHeight: 19,
  },
  drawerRowLabelDanger: {
    color: '#b91c1c',
    fontWeight: '600',
  },
  drawerFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#fafafa',
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  drawerBackdropTapArea: {
    flex: 1,
  },
});
