import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, PanResponder, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, { Path, SvgXml } from 'react-native-svg';

import type { RootStackParamList } from '../../navigation/types';
import { Button } from '../../components/ui/button';
import { Text } from '../../components/ui/text';
import { deleteMySignature, getMySignature, saveMySignature } from '../../api/operator';
import { LoadingOverlay } from '../../components/ui/loading-overlay';
import { setSignatureCache } from '../../lib/signature-cache';

type Props = NativeStackScreenProps<RootStackParamList, 'Signature'>;

type Point = { x: number; y: number };
type Stroke = { points: Point[] };
type SavedSignature = { signature_svg?: string | null };

const SIGNATURE_VIEWBOX = { width: 1000, height: 420 } as const;

function pointsToPath(points: Point[]): string {
  if (!points.length) return '';
  const [first, ...rest] = points;
  let d = `M ${first!.x.toFixed(2)} ${first!.y.toFixed(2)}`;
  for (const p of rest) {
    d += ` L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  }
  return d;
}

function scaleStrokesToViewBox(
  strokes: Stroke[],
  padSize: { width: number; height: number },
): Stroke[] {
  if (!padSize.width || !padSize.height) return strokes;
  const sx = SIGNATURE_VIEWBOX.width / padSize.width;
  const sy = SIGNATURE_VIEWBOX.height / padSize.height;
  return strokes.map(s => ({
    points: s.points.map(p => ({ x: p.x * sx, y: p.y * sy })),
  }));
}

function signatureSvgFromStrokes(strokes: Stroke[]): string {
  // Store a full SVG so backend can persist directly.
  const paths = strokes
    .map(s => pointsToPath(s.points))
    .filter(Boolean)
    .map(
      d =>
        `<path d="${d}" stroke="#0f172a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none" />`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIGNATURE_VIEWBOX.width} ${SIGNATURE_VIEWBOX.height}">${paths}</svg>`;
}

export function SignatureScreen({ navigation }: Props) {
  const padRef = useRef<View | null>(null);
  const [padSize, setPadSize] = useState({ width: 0, height: 0 });
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [activePoints, setActivePoints] = useState<Point[]>([]);
  const activePointsRef = useRef<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverSvg, setServerSvg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const hasInk = strokes.length > 0 || activePoints.length > 0;

  const loadSaved = useCallback(async () => {
    setLoading(true);
    try {
      const saved = (await getMySignature()) as SavedSignature;
      const svg = typeof saved?.signature_svg === 'string' ? saved.signature_svg : null;
      const normalized = svg && svg.trim() ? svg.trim() : null;
      setServerSvg(normalized);
      await setSignatureCache(Boolean(normalized));
      // Keep drawing canvas empty until user starts drawing; saved preview is shown below.
      setStrokes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    navigation.setOptions({ title: 'Signature' });
    loadSaved().catch(() => {});
  }, [loadSaved, navigation]);

  const panResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const start = [{ x: locationX, y: locationY }];
        activePointsRef.current = start;
        setActivePoints(start);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const next = [...activePointsRef.current, { x: locationX, y: locationY }];
        activePointsRef.current = next;
        setActivePoints(next);
      },
      onPanResponderRelease: () => {
        const strokePoints = activePointsRef.current;
        if (strokePoints.length) {
          setStrokes(prev => [...prev, { points: strokePoints }]);
        }
        activePointsRef.current = [];
        setActivePoints([]);
      },
      onPanResponderTerminate: () => {
        activePointsRef.current = [];
        setActivePoints([]);
      },
    });
  }, []);

  const onClear = async () => {
    setActivePoints([]);
    activePointsRef.current = [];
    setStrokes([]);
    setSaving(true);
    try {
      await deleteMySignature();
      setServerSvg(null);
      await setSignatureCache(false);
      Alert.alert('Signature cleared', 'Your saved signature was removed.');
    } finally {
      setSaving(false);
    }
  };

  const onSave = async () => {
    if (!strokes.length) return;
    setSaving(true);
    try {
      const scaled = scaleStrokesToViewBox(strokes, padSize);
      await saveMySignature(signatureSvgFromStrokes(scaled));
      const saved = await getMySignature();
      const svg =
        typeof saved.signature_svg === 'string' && saved.signature_svg.trim()
          ? saved.signature_svg.trim()
          : null;
      setServerSvg(svg);
      if (!svg) {
        Alert.alert(
          'Save failed',
          'Signature was not returned by the server. Please try again.',
        );
        return;
      }
      await setSignatureCache(true);
      Alert.alert('Saved', 'Your signature was saved to your account.');
      navigation.goBack();
    } catch (e: unknown) {
      const anyErr = e as {
        message?: string;
        response?: { status?: number; data?: unknown };
        config?: { baseURL?: string; url?: string; method?: string };
      };
      const status = anyErr?.response?.status;
      const base = anyErr?.config?.baseURL ?? '';
      const path = anyErr?.config?.url ?? '';
      const method = (anyErr?.config?.method ?? 'request').toUpperCase();
      const msg =
        status != null
          ? `${method} ${base}${path}\n\nRequest failed with status code ${status}`
          : anyErr?.message || 'Request failed. Please try again.';
      Alert.alert('Save failed', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-muted/30 p-4">
      <LoadingOverlay
        visible={saving}
        title="Saving signature…"
        message="Please wait. Do not close the app."
      />
      <View className="mb-3 rounded-2xl border border-border/70 bg-background p-3">
        <Text className="text-foreground text-sm font-semibold">Add your signature</Text>
        <Text className="text-muted-foreground mt-1 text-xs leading-4">
          Sign inside the box below. This signature is saved on your account.
        </Text>
      </View>

      <View
        ref={(r) => {
          padRef.current = r;
        }}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setPadSize({ width, height });
        }}
        style={styles.pad}
        {...panResponder.panHandlers}
        accessibilityRole="image"
        accessibilityLabel="Signature pad"
      >
        <Svg width="100%" height="100%">
          {strokes.map((s, idx) => (
            <Path
              key={String(idx)}
              d={pointsToPath(s.points)}
              stroke="#0f172a"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              opacity={0.95}
            />
          ))}
          {activePoints.length ? (
            <Path
              d={pointsToPath(activePoints)}
              stroke="#0f172a"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              opacity={0.95}
            />
          ) : null}
        </Svg>
      </View>

      {serverSvg ? (
        <View className="mt-3 overflow-hidden rounded-2xl border border-border/70 bg-background">
          <View className="border-b border-border/60 bg-muted/30 px-3 py-2.5">
            <Text className="text-foreground text-sm font-semibold">Saved signature</Text>
            <Text className="text-muted-foreground mt-0.5 text-xs">
              Currently saved on your account.
            </Text>
          </View>
          <View className="px-3 py-3">
            <View className="overflow-hidden rounded-xl border border-border/60 bg-white">
              <SvgXml xml={serverSvg} width="100%" height={140} />
            </View>
          </View>
        </View>
      ) : (
        <View className="mt-3 rounded-2xl border border-dashed border-border/70 bg-background p-3">
          <Text className="text-foreground text-sm font-semibold">No signature saved</Text>
          <Text className="text-muted-foreground mt-1 text-xs">
            Draw your signature above, then tap Save.
          </Text>
        </View>
      )}

      <View className="mt-3 flex-row gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onPress={() => onClear().catch(() => {})}
          disabled={(!hasInk && !serverSvg) || saving}
        >
          Clear
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          onPress={() => loadSaved().catch(() => {})}
          disabled={loading || saving}
        >
          Reload
        </Button>
      </View>

      <View className="mt-2 flex-row gap-2">
        <Button variant="ghost" className="flex-1" onPress={() => navigation.goBack()}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          onPress={() => onSave().catch(() => {})}
          disabled={!strokes.length || saving || loading}
        >
          Save
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    flex: 1,
    minHeight: 260,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.55)',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
});

